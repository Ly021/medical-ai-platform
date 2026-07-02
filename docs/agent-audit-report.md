# Agent 代码审计报告：医疗健康智能助手

> 审计日期：2026-07-02 | 审计范围：全栈代码库 | 综合定级：**Demo / 原型阶段**

---

## 综合技能雷达图

```
                    核心Agent架构 (3/10)
                         /|\
                        / | \
                       /  |  \
                      /   |   \
       工程化 (2/10)  /    |    \  医疗安全 (1/10)
                    /     |     \
                   /      |      \
                  /       |       \
                 /        |        \
                /         |         \
      RAG知识增强(6/10)   |   前端交互 (4/10)
                          |
                    提示词工程 (1/10)
```

| 维度 | 得分 | 判定 |
|------|------|------|
| 核心Agent架构 | 3/10 | 仅基础 ReAct 循环，deepagents 已安装但零使用，无规划/反思/子Agent |
| 医疗安全与护栏 | 1/10 | 零内容审核、零风险词触发、零免责声明 |
| 工程化可观测性 | 2/10 | 无 LangFuse/LangSmith、无结构化日志、无认证鉴权 |
| RAG知识增强 | 6/10 | 插件式架构优秀，Hybrid检索到位，但缺评估指标和医学知识库 |
| 流式与异步 | 4/10 | 前后端均支持 SSE，但工具调用无并发、前端无重连 |
| 记忆系统 | 2/10 | 仅有 MemorySaver 短期记忆，无长期画像、无跨会话能力 |
| 提示词工程 | 1/10 | 硬编码单行字符串，无模板、无版本管理、无少样本示例 |
| 状态管理 | 3/10 | Redux 已搭建但未使用；后端全内存，重启丢失 |

---

## TOP 5 代码坏味道

### 1. 零医疗安全护栏（高危）

**位置：** `medical-assistant-server/src/agent/agent.service.ts:72-77`

**问题：**
- 无自杀/暴力等紧急表述检测
- 无免责声明强制追加
- 无处方/诊断禁止约束
- 系统提示词仅一句英文指令

**修复方向：**

```typescript
// 输入层安全审核
private safetyGuard(input: string): string | null {
  const emergencyPatterns = [
    /自杀|自残|想死|不想活|结束生命|轻生/,
    /杀人|伤人|暴力/,
  ];
  for (const pattern of emergencyPatterns) {
    if (pattern.test(input)) {
      return '我注意到您的表述涉及紧急情况。请立即拨打 110 或全国心理援助热线 400-161-9995（24小时）。我不是医疗急救系统，无法提供紧急帮助。';
    }
  }
  return null; // 通过审核
}

// 系统提示词中嵌入安全准则
const MEDICAL_SYSTEM_PROMPT = `你是一个健康信息助手，而非执业医师。

【安全准则】
1. 遇到"自杀""自残""想死"等紧急表述，立即回复紧急话术
2. 每条回复必须以"⚠️ 重要提示：我是AI健康助手，不能替代专业医生诊断。如有身体不适，请及时就医。"结尾
3. 禁止开具处方、禁止给出确诊结论、禁止建议停用已在服用的药物
4. 当用户描述的症状可能为急症（胸痛、卒中征兆、严重过敏等）时，优先建议立即就医`;
```

### 2. Agent 与 RAG 系统脱节

**位置：** `agent.service.ts` 使用自建 `KnowledgeService`，`rag/` 有完整的 Qdrant + Hybrid 系统

**问题：**
- 两套检索重复建设
- Agent 的 searchKnowledge 工具实际查的是 `data/knowledge.txt`（开发者文档）而非医学知识
- RAG 模块的 Qdrant、Hybrid 检索、PDF 解析等能力完全未被 Agent 使用

**修复方向：**
- Agent 的 `searchKnowledge` 工具改为调用 `PipelineService.query()`
- 导入真实医学知识库（临床指南、药品说明书 PDF）
- RAG 回答中标注来源文档引用

### 3. 系统提示词硬编码

**位置：** `agent.service.ts:75`

**问题：**
- 一行字符串写死在代码中，修改需重新部署
- 无变量注入、无少样本示例
- 无版本管理

**修复方向：**
- 创建 `prompts/` 目录，用文件管理提示词版本
- 引入 `PromptTemplate` 支持 `{knowledgeDate}`、`{history}`、`{input}` 等变量注入
- 加入 3-5 个医疗场景少样本示例

### 4. 前端零会话持久化

**位置：** `medical-assistant-web/src/pages/HealthQA/index.tsx:13-18`

**问题：**
- 消息全在 React state，刷新页面全部丢失
- 无会话列表、无会话切换
- 无会话标题/时间戳等元数据

**修复方向：**
- MVP 阶段：`localStorage` 持久化 + 会话列表侧边栏
- 后续迁移：后端 `POST /conversations` CRUD API + SQLite/PostgreSQL 持久化

### 5. 流式事件类型单一

**位置：** `agent.service.ts:95-115`

**问题：**
- 仅产出 `chunk` 和 `status` 两种事件
- 前端无法展示工具调用的中间结果、引用来源、Agent 思考过程
- 用户只能看到"正在调用工具: xxx"的文本提示

**修复方向：**
- 增加 `thinking`（思考过程）、`tool_start`（工具调用开始）、`tool_result`（工具执行结果）事件类型
- 前端对应渲染思考链折叠面板和引用卡片

---

## 三阶段进化路线图

### Phase 1 — 可靠的助手（MVP，预计 2-3 周）

| # | 当前 → 目标 | 关键动作 |
|---|------------|---------|
| 1.1 | 零护栏 → 基础安全层 | 输入层敏感词检测（自杀/暴力正则）+ 输出层免责声明强制追加（后置拦截器）+ 急症关键词 → 兜底就医建议话术 |
| 1.2 | 无持久化 → 多轮对话 | 后端增加 `POST /conversations` CRUD API + SQLite 存储会话与消息 + 前端会话列表侧边栏，支持新建/切换/删除 |
| 1.3 | Agent/RAG分离 → 统一检索 | Agent 的 `searchKnowledge` 工具改为调用 `PipelineService`（Qdrant + Hybrid 检索）+ 导入真实医学知识库 + 引用溯源 |
| 1.4 | 硬编码提示词 → 模板化 | 创建 `prompts/` 目录 + `PromptTemplate` 支持变量注入 + 增加 3-5 个医疗场景少样本示例 |
| 1.5 | 无追踪 → 基础可观测 | 集成 LangFuse 追踪 Agent 思考链 + Token 消耗/工具调用耗时/错误率记录 + Winston/Pino 结构化日志 |

### Phase 2 — 专业的 Agent（核心竞争力，预计 4-8 周）

| # | 当前 → 目标 | 关键动作 |
|---|------------|---------|
| 2.1 | 单一检索 → Agentic RAG | Self-RAG 模式：先判断"知识库能否回答" → 检索 → 忠实度校验；知识库命中不足时降级到 PubMed/用药助手等外部 API |
| 2.2 | 单Agent → 多智能体协作 | Triage Agent(分诊) + Diagnosis Agent(咨询) + Medication Agent(用药审核) + Report Agent(报告解读)；LangGraph `StateGraph` 条件路由和子图嵌套 |
| 2.3 | 无画像 → 脱敏健康画像 | `UserHealthProfile` 模型（年龄/性别/过敏史/慢性病史/用药记录，全部可选+脱敏）+ LLM 自动提取摘要 + 画像注入系统提示词实现个性化 |
| 2.4 | 串行工具 → 并发调用 | LangGraph `Send` API：同时查药品库 + 疾病库 + 药物相互作用库 |
| 2.5 | 无评估 → RAGAS 体系 | 构建 200+ 医疗 QA 测试集（标注 ground truth）+ RAGAS 评估（忠实度/答案相关性/上下文召回率）+ CI 中自动回归 |

### Phase 3 — 市场领先（技术壁垒，预计 3-6 个月）

| # | 当前 → 目标 | 关键动作 |
|---|------------|---------|
| 3.1 | 纯文本 → 多模态 | 接入视觉-语言模型（GPT-4V / Qwen-VL）处理皮肤镜/X光影像 + 化验单 OCR 结构化提取 + 多模态 RAG（影像特征向量 + 文本病例联合检索） |
| 3.2 | 单次会话 → 跨天工作流 | Temporal.io / BullMQ 驱动的 Long-Running Agent：术后康复管理（定时换药提醒+饮食建议+伤口照片收集）、慢病管理（血糖/血压每日追踪+趋势预警） |
| 3.3 | 健康咨询 → CDSS | 循证医学引擎对接（UpToDate / 临床指南知识图谱）+ 可解释性（A/B/C 级证据推荐 + 文献引用）+ 鉴别诊断排序 + Human-in-the-Loop 高风险审核 |
| 3.4 | 单用户 → 多租户合规 | 医生端工作台（患者管理 + AI 辅助问诊）+ 患者端（健康档案 + AI 咨询）+ HL7 FHIR 标准数据交换 + HIPAA/个人信息保护法合规 + 审计日志 |
| 3.5 | 基础RAG → GraphRAG | 医学知识图谱（疾病-症状-药品-检查-科室）+ 药品相互作用路径推理 + 动态知识更新管线（新论文自动向量化+图谱更新） |

---

## 总结

**亮点：**
- RAG 模块的插件式架构设计在同类 Demo 项目中属于上乘，接口抽象和 DI 注入方式规范
- Hybrid 检索（向量 + BM25）+ RRF 融合是正确且有深度的工程选择
- TypeScript + NestJS + LangChain 技术栈选型合理，适合企业级扩展

**致命短板：**
1. **零安全护栏** — 一个医疗 AI 产品在没有任何内容审核的情况下上线是法律和伦理灾难
2. **知识库为空** — `knowledge.txt` 是开发者文档而非医学内容，RAG 形同虚设
3. **无用户记忆** — 每次对话都是"初次见面"，无法提供连贯的个性化健康建议
4. **deepagents 白装** — `createDeepAgent` 的规划、总结、子Agent、技能、文件系统中间件均未使用
5. **可观测性为零** — 无法解释 Agent 为何给出某个回答，生产环境不可接受

**行动建议：**
Phase 1 集中攻克三个致命缺口——安全护栏 + 会话持久化 + 真实医学知识库接入——之后才具备 MVP 上线的基本条件。

---

## 附录 A：多端转型方案（H5 / 小程序 / App）

### 当前结构的问题

```
medical-ai-platform/
├── medical-assistant-server/   # 后端 — NestJS
├── medical-assistant-web/      # 前端 — React Web（PC浏览器）
└── package.json                # npm workspace root
```

当前前端为桌面浏览器设计（Ant Design 侧边栏布局），搬到移动端体验很差。

### 推荐目标结构：pnpm monorepo + 分层共享

```
medical-ai-platform/
├── pnpm-workspace.yaml
├── package.json
│
├── packages/
│   └── shared/                     # 跨端共享层
│       ├── src/
│       │   ├── types/              # TS 类型（User, Message, HealthProfile...）
│       │   ├── api/                # 统一 API 客户端
│       │   ├── utils/              # 日期格式化、脱敏、常量
│       │   └── hooks/              # 框架无关的业务逻辑签名
│       └── package.json
│
├── apps/
│   ├── api/                        # 后端 — NestJS（原 medical-assistant-server）
│   │
│   ├── web/                        # H5 移动端 Web（原 medical-assistant-web 改造）
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/         # 移动端组件（底部导航、弹出层、卡片列表）
│   │   │   └── ...
│   │   └── package.json
│   │
│   ├── miniapp/                    # 微信小程序 — Taro + React
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── app.config.ts
│   │   └── package.json
│   │
│   └── mobile/                     # App — Expo (React Native)
│       ├── src/
│       │   ├── screens/
│       │   └── components/
│       └── package.json
│
└── docs/
```

### 技术选型对比

| 目标端 | 方案 A：Taro 统一 | 方案 B：各端独立（推荐） |
|--------|------------------|------------------------|
| **H5** | Taro H5 编译 | React + Vite + Vant UI（移动端组件库） |
| **微信小程序** | Taro 编译 | Taro + React + NutUI |
| **App (iOS/Android)** | Taro → RN 导出 | Expo (React Native) |
| **共享层** | Taro 内置跨平台 API | `@medical/shared` 包 |
| **优点** | 一套代码多端复用 | 各端 UI 体验最优，不受框架限制 |
| **缺点** | Taro 抽象层有坑，复杂交互难调 | 三套 UI 代码，维护成本较高 |

**建议：方案 B**，核心策略是让共享层承载所有纯逻辑（类型、API 封装、工具函数、状态机、业务规则），每端 UI 层只是调用共享能力的"薄壳"。实际代码量比约为 `shared 60% + web 15% + miniapp 15% + mobile 10%`。

### 迁移步骤

| 步骤 | 内容 |
|------|------|
| 1 | 安装 pnpm + 配置 `pnpm-workspace.yaml` |
| 2 | 抽取 `@medical/shared`：类型、API 客户端、工具函数 |
| 3 | 改造 `web/`：Vant UI 替代 Ant Design，侧边栏 → 底部 TabBar |
| 4 | 新建 `miniapp/`：`taro init` + 复用 shared，开发微信小程序版本 |
| 5 | 新建 `mobile/`：`npx create-expo-app` + 复用 shared，打包 APK/IPA |

### 各端组件库推荐

| 端 | UI 框架 | 说明 |
|----|---------|------|
| H5 | Vant 4 | 有赞出品，移动端组件最全，支持 Vue3/React |
| 小程序 | NutUI | 京东出品，专为小程序设计的 React 组件库 |
| App | React Native Paper | 遵循 Material Design 3，医疗类 App 常用 |

---

## 附录 B：个人实用功能规划

### 第一梯队：高频刚需（建议 MVP 优先实现）

| 功能 | 说明 | 技术要点 |
|------|------|---------|
| **智能问诊** | 输入症状 → AI 给出可能原因、就医建议、自我护理 | 接真实医学知识库 RAG |
| **用药提醒** | 设定药品/剂量/时间 → 到点推送通知 | 小程序订阅消息 / App 本地通知 / Web Push |
| **健康指标记录** | 血压/血糖/体重/体温，表格录入 + 趋势折线图 | 本地存储 + 定期同步后端 |
| **报告解读** | 拍照上传化验单/体检报告 → OCR → AI 逐项解读 | 多模态模型 + 报告模板匹配 |

### 第二梯队：实用工具

| 功能 | 说明 | 技术要点 |
|------|------|---------|
| **药物查询** | 搜药品名 → 查看说明书（适应症、用法、禁忌、相互作用） | 药品说明书向量库 |
| **BMI / 代谢计算器** | 输入身高体重 → BMI + 理想体重范围 + 基础代谢率 | 纯前端计算，离线可用 |
| **经期/备孕记录** | 日历标记 + 周期预测 + AI 健康提示 | 本地日历 + 统计算法 |
| **挂号/复诊备忘** | 记录下次就诊时间、科室、医生 → 提前提醒 | 本地存储 + 通知 |

### 第三梯队：特色工具

| 功能 | 说明 | 技术要点 |
|------|------|---------|
| **饮食拍照分析** | 拍一顿饭 → AI 估算热量和营养素 | 多模态模型 |
| **家庭健康仓** | 管理家人健康档案、过敏史、疫苗接种记录 | 多用户档案切换 |
| **日常健康日报** | 每日生成：天气敏感度 + 空气质量 + 个性化建议 | 天气 API + LLM 总结 |
| **疫苗日历** | 儿童疫苗接种计划模板 + 成人疫苗（流感/HPV/带状疱疹）提醒 | 固定规则引擎 |

### 建议 MVP 功能范围

```
智能问诊 + 用药提醒 + 健康指标记录 + 药物查询
```

覆盖"问、记、查、提醒"四个核心场景，技术上已有基础（Agent + RAG + 前端表单 + 通知），3-4 周可落地。
