# CLAUDE.md

Medical AI Platform — NestJS API + React Web 双项目 monorepo。

## 常用命令

```bash
npm run dev              # 同时启动 API + Web（concurrently）
npm run dev:api          # 仅启动 NestJS API（medical-assistant-server，端口 3000）
npm run dev:web          # 仅启动 React Web（medical-assistant-web，端口 5173）
npm run build            # 编译所有 workspace
npm run lint             # 所有 workspace lint
npm run test             # medical-assistant-server 单元测试
npm run test:e2e         # medical-assistant-server E2E 测试
```

针对单个 workspace：

```bash
npm -w medical-assistant-server run start:dev
npm -w medical-assistant-server run test
npm -w medical-assistant-web run dev
npm -w medical-assistant-web run build
```

## 项目结构

```
medical-ai-platform/
├── medical-assistant-server/                  # 后端 — NestJS 11 + LangChain AI Agent
│   ├── src/
│   │   ├── main.ts             # 入口，监听 3000 端口，启用 CORS / Swagger
│   │   ├── app.module.ts       # 根模块
│   │   ├── agent/              # AI Agent 模块（LangChain deepagents）
│   │   ├── rag/                # RAG 模块（Qdrant 向量检索 + PDF 解析）
│   │   ├── cats/               # 示例 CRUD 模块（开发模板）
│   │   └── common/middleware/  # 日志中间件
│   └── data/                   # PDF 知识库文件
├── medical-assistant-web/      # 前端 — React 19 + Ant Design 6 + Tailwind
│   └── src/
│       ├── pages/              # 页面组件
│       ├── components/         # 通用组件
│       ├── layouts/            # 布局组件
│       ├── store/              # Redux Toolkit store
│       ├── api/                # Axios API 调用
│       ├── hooks/              # 自定义 hooks
│       └── router.tsx          # 路由配置
├── tsconfig.base.json          # 共享 TS 配置
└── package.json                # workspace root
```

## 技术栈

| 层 | 后端 | 前端 |
|---|---|---|
| 框架 | NestJS 11 (Express 5) | React 19 |
| 语言 | TypeScript 5.7, NodeNext modules | TypeScript 6.0, ESNext modules |
| AI | LangChain + deepagents + OpenAI | — |
| 向量库 | Qdrant (via @langchain/qdrant) | — |
| UI | Swagger (OpenAPI) | Ant Design 6 + Tailwind 3 |
| 状态 | — | Redux Toolkit |
| 路由 | NestJS Router | React Router 7 |
| 测试 | Jest 30 | — |
| 构建 | Nest CLI / tsc | Vite 8 |

## 后端架构要点

```
请求 → Middleware（日志）→ Guard（权限）→ Controller → Service → 响应
```

- NestJS 11 使用 Express 5 + `@types/express` v5 API
- 模块系统：`nodenext`，target `ES2023`
- AI Agent 在 `src/agent/` 中通过 deepagents 创建
- RAG 系统在 `src/rag/` 中结合 Qdrant 向量库与 PDF 解析
- 新建功能模块：`src/<name>/` 下创建 module + controller + service，在 AppModule 注册

## 关键依赖

**后端核心**：`@nestjs/core` `@langchain/core` `deepagents` `zod` `class-validator`
**前端核心**：`react` `antd` `@reduxjs/toolkit` `react-router-dom` `tailwindcss` `axios`
