# 会话记录存储 — 实现计划

## Context

当前系统对话完全依赖内存：`AgentService` 用 `MemorySaver` 保存 LangGraph 状态，`HealthQA` 页用 `useState` 存消息。刷新页面或重启服务后所有对话丢失。需要引入 SQLite 持久化 + CRUD API + 前端会话管理。

## 方案概览

三阶段实现：后端 CRUD → 前端数据层 → 前端 UI 重构

---

## Phase 1: 后端 — SQLite + 会话 CRUD

### 1.1 安装依赖

```bash
npm -w medical-assistant-server install @nestjs/typeorm typeorm better-sqlite3
npm -w medical-assistant-server install -D @types/better-sqlite3
```

### 1.2 新建文件清单

**`src/conversations/conversation.entity.ts`** — Conversation 实体
- id (uuid, 自动生成), title (默认"新对话"), messages (text, JSON 字符串), threadId (unique), createdAt, updatedAt

**`src/conversations/dto/create-conversation.dto.ts`** — 创建 DTO
- title? (可选), threadId (必填), 带 `@ApiProperty` + `class-validator` 装饰器

**`src/conversations/dto/update-conversation.dto.ts`** — 更新 DTO
- title? (可选), messages? (可选 Message[]), 带完整 class-validator

**`src/conversations/conversations.service.ts`** — 业务逻辑
- `findAll()` — 按 updatedAt DESC
- `findOne(id)` — 查单个
- `create(dto)` — 创建，messages 初始 `'[]'`
- `update(id, dto)` — 更新 title/messages
- `remove(id)` — 删除

**`src/conversations/conversations.controller.ts`** — CRUD 端点
- `GET /api/conversations` — 列表
- `GET /api/conversations/:id` — 详情（含消息）
- `POST /api/conversations` — 创建
- `PATCH /api/conversations/:id` — 更新
- `DELETE /api/conversations/:id` — 删除
- 全部带 Swagger 装饰器（参考 `cats.controller.ts` 模式）

**`src/conversations/conversations.module.ts`** — 模块注册
- 导出 `ConversationsService`

**`src/agent/dto/chat.dto.ts`** — 修复 agent controller 内联 DTO 问题
- message, threadId?，补齐 `@ApiProperty` + class-validator

### 1.3 修改文件

**`src/app.module.ts`** — 加 `TypeOrmModule.forRoot()` + `ConversationsModule`
- type: better-sqlite3, database: `data/conversations.db`, synchronize: true

**`src/agent/agent.controller.ts`** — 移除内联 ChatDto，引入新 dto 文件，加 Swagger 装饰器

---

## Phase 2: 前端 — API 层 + Redux

### 2.1 新建文件

**`src/api/conversations.ts`** — 类型 + API 函数
- `Message`, `Conversation` 接口定义
- `conversationsApi` 对象：list/get/create/update/remove，全部基于 `apiClient`

**`src/store/slices/conversations.slice.ts`** — Redux slice
- 状态：`list`, `activeId`, `loading`
- 异步 thunk：`fetchConversations`, `createConversation`, `updateConversation`, `deleteConversation`
- 同步 action：`setActiveId`
- 模式参考 `user.slice.ts`

### 2.2 修改文件

**`src/store/index.ts`** — 注册 `conversationsReducer`

---

## Phase 3: 前端 — useChat hook + HealthQA 重构

### 3.1 新建 `src/hooks/useChat.ts`

从 HealthQA 提取流式对话逻辑：
- 管理本地 messages、loading、AbortController
- SSE 解析（chunk/status/error/done）
- 接收 `threadId` + `onMessagesChange` 回调
- 导出 `loadMessages(msgs)` 恢复历史

### 3.2 重构 `src/pages/HealthQA/index.tsx`

两栏布局：
- **左侧 260px 会话列表**: Card + List，每项显示标题 + 删除按钮，顶部 "新建对话" 按钮
- **右侧聊天区**: 现有 UI，用 `useChat` hook 替代本地 state

交互流程：
1. 进入页面 → `fetchConversations()` → 自动选中第一个
2. 新建 → `crypto.randomUUID()` 生成 threadId → `createConversation({ threadId })` → 自动激活
3. 切换 → `setActiveId(id)` → `get(id)` 加载消息 → `loadMessages()`
4. 删除 → `deleteConversation(id)` → 自动切换
5. 发消息 → `useChat.sendMessage()` → 流式结束后 `onMessagesChange` → `updateConversation()`
6. 首条消息 → 自动设标题为用户消息前 20 字

---

## 验证方式

1. `curl http://localhost:3000/api/conversations` 初始返回 `[]`
2. 前端创建会话 → 再次 curl 确认已持久化
3. 发送消息后刷新页面 → 消息恢复
4. 重启 `npm run dev:api` → SQLite 文件 `data/conversations.db` 存在，数据不丢失
5. 删除会话 → curl 确认删除

---

## 关键决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 数据库 | SQLite (better-sqlite3) | 零配置，单文件，开发阶段足够 |
| ORM | TypeORM | NestJS 生态标准，`@InjectRepository` 模式 |
| 消息存储 | JSON 字符串（text 列） | 单读单写，简单高效 |
| 消息保存方 | 前端主动调用 PATCH | 后端无需改动 agent 服务，职责清晰 |
| ID 生成 | 前端 `crypto.randomUUID()` | 无需额外依赖 |
| synchronize | true | 早期开发，自动建表 |
