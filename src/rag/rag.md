# RAG 流水线框架

> 本文档面向**零基础**读者，用大白话解释每一个概念。即使你不懂 NestJS，也不懂 RAG，读完也能理解这个项目在做什么、怎么跑起来、怎么改。

---

## 一、先搞清楚：这个项目到底在做什么？

### 1.1 一句话概括

**把一堆文档喂给程序，然后你可以用自然语言向它提问，它会从文档里找答案，用 AI 生成回复。**

### 1.2 生活类比

想象你有一个超级图书管理员：

1. **入库阶段** — 你把书给他，他拆成段落，给每段贴上"标签"（向量），存进档案柜（向量数据库）
2. **查询阶段** — 你问他一个问题，他去档案柜翻出最相关的段落，交给"秘书"（大模型）帮你总结成一段话

这就是 RAG（Retrieval-Augmented Generation，检索增强生成）：
- **Retrieval（检索）** = 从档案柜找相关段落
- **Augmented（增强）** = 把找到的段落作为"参考资料"塞给大模型
- **Generation（生成）** = 大模型根据资料回答问题

### 1.3 为什么需要 RAG？

大模型（如 ChatGPT、智谱 GLM）有两个致命问题：
- **知识截止**：只知道自己训练时的数据，不知道新信息
- **幻觉**：遇到不懂的问题会"编造"答案

RAG 的思路很朴素：**你先告诉我资料在哪，我找到后再回答**。这样回答就有了依据，也不容易瞎编。

---

## 二、NestJS 到底是个啥？

你不需要成为 NestJS 专家，但了解三个概念就能看懂代码：

### 2.1 类比 Django / Spring Boot

| 概念 | NestJS | Django | Spring Boot |
|------|--------|--------|-------------|
| 模块组织 | Module | App | @Configuration |
| 路由处理 | Controller | View / ViewSet | @RestController |
| 业务逻辑 | Service（Provider） | Service | @Service |
| 依赖注入 | `@Injectable()` + 构造函数 | DI 容器 | @Autowired |

### 2.2 三个核心概念

**Module（模块）** — 相当于一个"功能包"，把相关的 Controller、Service 打包在一起。比如 `RagModule` 就是 RAG 功能包。

**Controller（控制器）** — 负责"接客"，处理 HTTP 请求。比如 `POST /rag/search` 来了，Controller 负责接收参数，交给 Service 去做事，再把结果返回。

**Service / Provider（服务）** — 负责"干活"，写真正的业务逻辑。Controller 不干活，只调度。

### 2.3 依赖注入（DI）是什么？

```typescript
// ❌ 不用 DI：自己 new，耦合死了
class A {
  private b = new B();  // A 和 B 死死绑在一起
}

// ✅ 用 DI：谁用谁注入，A 不关心 B 怎么来的
class A {
  constructor(private b: B) {}  // NestJS 自动帮你把 B 塞进来
}
```

好处：测试时可以把 B 换成假的（Mock），不改 A 的代码。这个项目的"可插拔"就靠这个机制。

### 2.4 本项目用到的 NestJS 装饰器速查

| 装饰器 | 作用 | 例子 |
|--------|------|------|
| `@Module({...})` | 定义一个模块 | `export class RagModule {}` |
| `@Controller('rag')` | 定义路由前缀 | 处理所有 `/rag/*` 请求 |
| `@Injectable()` | 标记为可注入的类 | 所有的 Service |
| `@Inject(TOKEN)` | 按名字注入依赖 | `@Inject(VECTOR_STORE_TOKEN)` |
| `@Post('search')` | 处理 POST 请求 | 处理 `POST /rag/search` |
| `@Body()` | 取请求体中的数据 | `@Body() dto: SearchDto` |

---

## 三、项目文件地图

打开 `src/rag/` 文件夹，你会看到下面这些文件。按照"你第一次读代码"的顺序排列：

### 3.1 必读（理解框架的入口）

```
src/rag/
├── rag.md                          ← 你正在读的文档
├── rag.constants.ts                ← 全局"暗号"（DI token + 类型定义）
├── rag.config.ts                   ← 有哪些配置项
├── rag.module.ts                   ← 组装工厂：根据配置选择用哪个实现
│
├── interfaces/                     ← "合同"：每个角色必须履行的职责
│   ├── loader.interface.ts         ←    文档加载器合同
│   ├── splitter.interface.ts       ←    文本分割器合同
│   ├── embedder.interface.ts       ←    向量化器合同
│   ├── vector-store.interface.ts   ←    向量存储合同
│   ├── retriever.interface.ts      ←    检索器合同
│   └── generator.interface.ts      ←    生成器合同
│
├── pipeline/                       ← 流水线编排：串联各个阶段
│   ├── ingestion.pipeline.ts       ←    入库流水线
│   ├── query.pipeline.ts           ←    查询流水线
│   └── pipeline.service.ts         ←    门面：对外提供统一接口
│
├── rag.controller.ts               ← HTTP 接口层：/rag/ingest、/rag/search 等
└── rag.cli.ts                      ← 命令行工具（不用开 HTTP 服务也能用）
```

### 3.2 看情况读（具体实现）

```
├── loaders/                        ← 各种文档加载器的具体实现
│   ├── txt.loader.ts               ←    读 .txt 文件
│   ├── markdown.loader.ts          ←    读 .md 文件
│   ├── pdf.loader.ts               ←    读 .pdf 文件
│   └── directory.loader.ts         ←    读整个目录（按扩展名自动选 loader）
│
├── splitters/
│   └── recursive-text-splitter.ts  ← 文本切块器
│
├── embedders/
│   └── openai-compatible.embedder.ts ← 用智谱 API 做向量化
│
├── vector-stores/                  ← 向量存在哪里
│   ├── memory.vector-store.ts      ←    存内存（开发测试用，重启就丢）
│   └── qdrant.vector-store.ts      ←    存 Qdrant（生产用，持久化）
│
├── retrievers/                     ← 怎么从向量库检索
│   ├── similarity.retriever.ts     ←    纯向量相似度
│   └── hybrid.retriever.ts         ←    向量 + 关键词混合（效果更好）
│
└── generators/
    └── llm.generator.ts            ← 用大模型生成最终回答
```

### 3.3 辅助文件

```
├── dto/                            ← Data Transfer Object（请求参数校验）
│   ├── ingest.dto.ts               ←   入库请求的参数格式
│   ├── search.dto.ts               ←   检索请求的参数格式
│   └── query.dto.ts                ←   问答请求的参数格式
│
├── rag.spec.ts                     ← 集成测试
└── vector-stores/memory.vector-store.spec.ts ← 内存向量库单元测试
```

---

## 四、核心概念：六个"零件"

整个 RAG 框架像一条流水线，由六个可替换的零件组成。每个零件都是一份"合同"（interface），你想换什么实现都行。

### 4.1 入库流水线（Ingestion Pipeline）

```
文档文件  →  ILoader  →  ITextSplitter  →  IEmbedder  →  IVectorStore
 (硬盘)      (读取)       (切段)           (向量化)       (存档)
```

#### 零件一：ILoader — 文档加载器

**做什么**：把硬盘上的文件读进内存。

```typescript
// 合同：你只需要告诉我怎么 load，返回 Document 数组就行
interface ILoader {
  name: string;                             // 你的名字（如 "txt"、"pdf"）
  load(source: string): Promise<Document[]>; // source 是文件路径
}
```

**已有的实现**：

| 实现 | 能处理 | 原理 |
|------|--------|------|
| `TxtLoader` | `.txt` | `fs.readFileSync` 直接读 |
| `MarkdownLoader` | `.md` | 同上 |
| `PdfLoader` | `.pdf` | 用 pdf-parse 库解析 |
| `DirectoryLoader` | 整个文件夹 | 递归遍历，按扩展名分发给上面的 loader |

**Document 是什么？** 来自 LangChain 库的一个数据结构：
```typescript
// 每一篇文档就是一个 Document 对象
{
  pageContent: "文档的正文内容...",  // 文本主体
  metadata: {                        // 附带信息（来源、格式等）
    source: "/path/to/file.txt",
    format: "txt"
  }
}
```

#### 零件二：ITextSplitter — 文本分割器

**做什么**：大模型一次能处理的文字有限（上下文窗口），所以要把长文档切成小段。

```typescript
interface ITextSplitter {
  name: string;
  splitDocuments(docs: Document[]): Promise<Document[]>;  // 1个长doc → N个短doc
}
```

**为什么要切？** 假设文档有 10000 字，大模型一次只能看 4000 字。切成每段 500 字，检索时只需要喂给大模型最相关的几段（比如 4 段 = 2000 字），不超限。

**默认实现**：`RecursiveTextSplitter`
- 按段落 → 按句子 → 按词的优先级逐级切分
- `chunkSize=500`：每段最多 500 个字符
- `chunkOverlap=50`：段与段之间重叠 50 个字符（避免一句话被拦腰截断）

#### 零件三：IEmbedder — 向量化器

**做什么**：把文字变成数字数组（向量）。因为计算机不会"理解"文字，只会算数字。

```typescript
interface IEmbedder {
  name: string;
  dimensions: number;                             // 向量维度（如 1024）
  embedDocuments(texts: string[]): Promise<number[][]>;  // 批量：["段落1","段落2"] → [[0.1,0.3,...], [0.2,0.5,...]]
  embedQuery(text: string): Promise<number[]>;            // 单句：  "用户问题"    → [0.15,0.35,...]
}
```

**向量化是 RAG 的魔法核心**。两个向量的方向越接近，说明它们的意思越接近。

```
"苹果很好吃" → [0.8, 0.1, 0.3, ...]
"这个水果真甜" → [0.75, 0.15, 0.28, ...]  ← 很接近！余弦相似度 ≈ 0.95
"今天天气不错" → [0.1, 0.9, 0.05, ...]     ← 差很远！余弦相似度 ≈ 0.12
```

本项目用的是**智谱 Embedding-2 模型**（1024 维），走 OpenAI 兼容协议。

#### 零件四：IVectorStore — 向量存储

**做什么**：把向量和对应的文档存起来，支持相似度搜索。

```typescript
interface IVectorStore {
  name: string;
  addVectors(vectors, docs, options?): Promise<void>;         // 存入
  similaritySearch(query, k?): Promise<Document[]>;            // 按文字搜（内部先向量化）
  similaritySearchVector(embedding, k?): Promise<Document[]>;  // 按向量搜
  delete(params): Promise<void>;                               // 删除
}
```

**已有实现**：

| 实现 | 适用场景 | 特点 |
|------|----------|------|
| `MemoryVectorStore` | 开发/测试 | 存内存，暴力算余弦相似度，重启就丢 |
| `QdrantVectorStore` | 生产环境 | 持久化，HNSW 索引，速度快，支持过滤 |

### 4.2 查询流水线（Query Pipeline）

```
用户问题  →  IEmbedder  →  IRetriever  →  IGenerator  →  最终回答
("NestJS是啥")  (向量化)      (检索)         (生成)
```

#### 零件五：IRetriever — 检索器

**做什么**：从向量库里翻出和问题最相关的文档。

```typescript
interface IRetriever {
  name: string;
  retrieve(query: string, k?: number): Promise<Document[]>;
  // k = 返回前几条（默认 4）
}
```

**已有实现**：

| 实现 | 原理 | 什么时候用 |
|------|------|------------|
| `SimilarityRetriever` | 纯向量相似度 | 语义匹配好，但可能漏掉精确关键词 |
| `HybridRetriever` | 向量 + BM25 关键词，RRF 融合 | 兼顾语义和关键词，效果更好 |

**BM25 是什么？** 一种经典的关键词匹配算法。你搜"依赖注入"，它找包含"依赖"或"注入"的文档。向量检索找"意思相近"的，BM25 找"字面匹配"的。两者结合，取长补短。

**RRF（Reciprocal Rank Fusion）** 是把两个排名合并的算法。`alpha=0.7` 表示向量得分占 70%，BM25 占 30%。

#### 零件六：IGenerator — 生成器

**做什么**：把用户问题 + 检索到的文档拼成一段 prompt，交给大模型生成回答。

```typescript
interface IGenerator {
  name: string;
  generate(query, context): Promise<string>;                             // 一次性返回
  generateStream(query, context): AsyncGenerator<StreamChunk>;           // 逐字流式输出
}
```

**默认实现**：`LlmGenerator`
- 模型：智谱 GLM-4.7-Flash（快且便宜）
- 支持流式（SSE，一个字一个字往外蹦）和非流式两种

**内部 prompt 模板**（实际发给大模型的内容）：
```
你是一个知识库助手。请根据以下参考资料回答用户问题。
如果参考资料中没有相关信息，请如实告知用户。
请用中文回答。

参考资料：
[文档1]
NestJS 是一个 Node.js 框架，使用依赖注入模式...

[文档2]
LangChain Agent 是一个可以调用工具的智能体...

（用户问题附在后面）
```

---

## 五、完整数据流走一遍

用一个具体例子，把整个流程串起来。

### 5.1 入库：把 `data/knowledge.txt` 喂进去

```
步骤1: ILoader.load("data/knowledge.txt")
       → 读文件内容 → 返回 1 个 Document { pageContent: "全文...", metadata: {source: "data/knowledge.txt"} }

步骤2: ITextSplitter.splitDocuments([那1个Document])
       → 切成每段 ≤500 字 → 返回 20 个 Document（每个是一小段）

步骤3: IEmbedder.embedDocuments([20个段落的文本])
       → 调智谱 API → 返回 20 个 float[] 数组（每个是 1024 维向量）

步骤4: IVectorStore.addVectors(20个向量, 20个文档段, { ids: [uuid1,uuid2,...] })
       → 存入 Qdrant（或内存）
```

**对应的 HTTP 请求**：
```bash
curl -X POST http://localhost:3000/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{"source":"data/knowledge.txt"}'
```

**返回**：
```json
{
  "success": true,
  "sourceDocuments": 1,
  "chunks": 20,
  "ids": ["a1b2c3d4-...", "e5f6g7h8-...", ...]
}
```

### 5.2 问答："什么是 NestJS 依赖注入？"

```
步骤1: IRetriever.retrieve("什么是 NestJS 依赖注入？", k=4)
       → 先把问题向量化（IEmbedder.embedQuery）
       → 在向量库搜最接近的 4 个段落
       → 返回 4 个 Document

步骤2: IGenerator.generate("什么是 NestJS 依赖注入？", 那4个Document)
       → 拼 prompt（系统提示 + 4 段参考文档 + 用户问题）
       → 调智谱大模型
       → 返回 "NestJS 的依赖注入是一种设计模式，通过 @Injectable() 装饰器..."
```

**对应的 HTTP 请求**：
```bash
# 非流式
curl -X POST http://localhost:3000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question":"什么是NestJS依赖注入"}'

# 流式（逐字输出）
curl -N -X POST http://localhost:3000/rag/query/stream \
  -H "Content-Type: application/json" \
  -d '{"question":"什么是NestJS依赖注入"}' --max-time 60
```

---

## 六、可插拔是怎么实现的？

这是整个框架的设计精髓。一句话：**通过配置切换实现，不改代码**。

### 6.1 问题场景

假设你有两套方案：
- 开发时：TxtLoader + 内存存储（省钱、不用装 Docker）
- 生产时：DirectoryLoader + Qdrant + 混合检索

传统写法你得改代码。可插拔写法你只需改配置。

### 6.2 实现机制

看 `rag.module.ts` 的第 40-43 行：

```typescript
const loaderProvider = {
  provide: LOADER_TOKEN,        // 注入时用这个名字找
  useFactory: (config) => {     // 工厂函数：运行时决定 new 哪个
    const type = config.get('RAG_LOADER', 'txt');  // 读配置，默认 'txt'
    switch (type) {
      case 'txt':       return new TxtLoader();
      case 'directory': return new DirectoryLoader(config);
      // ... 加新类型只需在这加一个 case
    }
  },
};
```

所有用到 loader 的地方只写 `@Inject(LOADER_TOKEN)`，不写死 `new TxtLoader()`。这样配置一变，所有地方自动切换。

### 6.3 切换方式

**方式一：改 .env 文件**
```bash
# 开发环境
RAG_LOADER=txt
RAG_VECTOR_STORE=memory
RAG_RETRIEVER=similarity

# 生产环境
RAG_LOADER=directory
RAG_VECTOR_STORE=qdrant
RAG_RETRIEVER=hybrid
```

**方式二：代码传参**（优先级更高）
```typescript
RagModule.register({
  retriever: 'hybrid',
  chunkSize: 800,
});
```

**优先级**：代码传参 > 环境变量 > 默认值

---

## 七、配置项速查表

### 阶段选择

| 你要选什么 | 环境变量 | 默认值 | 可选值 |
|-----------|----------|--------|--------|
| 文档加载器 | `RAG_LOADER` | `txt` | `txt` / `markdown` / `pdf` / `directory` |
| 文本分割器 | `RAG_SPLITTER` | `recursive` | 目前只有 `recursive` |
| 向量化器 | `RAG_EMBEDDER` | `openai-compatible` | 目前只有 `openai-compatible` |
| 向量存储 | `RAG_VECTOR_STORE` | `memory` | `memory` / `qdrant` |
| 检索器 | `RAG_RETRIEVER` | `similarity` | `similarity` / `hybrid` |
| 生成器 | `RAG_GENERATOR` | `llm` | 目前只有 `llm` |

### 数值参数

| 参数 | 环境变量 | 默认值 | 什么意思 |
|------|----------|--------|----------|
| 分块大小 | `RAG_CHUNK_SIZE` | `500` | 每段最多多少个字符 |
| 分块重叠 | `RAG_CHUNK_OVERLAP` | `50` | 相邻两段重叠多少个字符 |
| 检索数量 | `RAG_RETRIEVAL_K` | `4` | 每次检索返回几条 |
| 混合权重 | `RAG_HYBRID_ALPHA` | `0.7` | 向量得分占比（0=纯关键词，1=纯向量） |

### 模型参数

| 参数 | 环境变量 | 默认值 |
|------|----------|--------|
| 智谱 API Key | `ZHIPU_API_KEY` | 必须自己填 |
| Embedding 模型 | `EMBEDDING_MODEL` | `embedding-2` |
| LLM 模型 | `LLM_MODEL` | `glm-4.7-flash` |
| LLM 温度 | `LLM_TEMPERATURE` | `0.3` |

---

## 八、API 端点一览

所有接口前缀：`http://localhost:3000/rag`

| 端点 | 方法 | 做什么 | 请求体 |
|------|------|--------|--------|
| `/rag/ingest` | POST | 文档入库 | `{ "source": "文件或目录路径" }` |
| `/rag/search` | POST | 纯检索（不生成回答） | `{ "query": "关键词", "k": 5 }` |
| `/rag/query` | POST | RAG 问答（一次性返回） | `{ "question": "问题" }` |
| `/rag/query/stream` | POST | RAG 问答（逐字流式） | `{ "question": "问题" }` |

**Search vs Query 的区别**：
- `/rag/search` — 只做检索，返回相关文档片段。适合你想自己看原文。
- `/rag/query` — 检索 + 生成，返回 AI 总结好的回答。适合直接要答案。

---

## 九、CLI 命令行工具

不想开 HTTP 服务也能用：

```bash
# 入库（把 ./data 目录下的文件全读进去）
npx ts-node src/rag/rag.cli.ts ingest ./data

# 检索（搜 5 条）
npx ts-node src/rag/rag.cli.ts search "NestJS依赖注入" 5

# 问答
npx ts-node src/rag/rag.cli.ts query "什么是LangChain Agent"
```

CLI 内部做的事和 HTTP 接口完全一样，只是输入输出方式不同。

---

## 十、怎么扩展

### 10.1 加一个新的文档加载器（比如支持 .json 文件）

**第 1 步**：创建文件 `src/rag/loaders/json.loader.ts`

```typescript
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { Document } from '@langchain/core/documents';
import type { ILoader } from '../interfaces/loader.interface';

@Injectable()
export class JsonLoader implements ILoader {
  readonly name = 'json';

  async load(source: string): Promise<Document[]> {
    const raw = fs.readFileSync(source, 'utf-8');
    const obj = JSON.parse(raw);
    // 假设 JSON 里有个 "content" 字段
    return [new Document({
      pageContent: obj.content,
      metadata: { source, format: 'json' },
    })];
  }
}
```

**第 2 步**：在 `rag.constants.ts` 里加类型

```typescript
export type LoaderType = 'txt' | 'markdown' | 'pdf' | 'directory' | 'json';
//                                                                  ^^^^^^
```

**第 3 步**：在 `rag.module.ts` 的 `loaderProvider` 工厂函数里加一个 case

```typescript
case 'json': return new JsonLoader();
```

**第 4 步**：（如果是 DirectoryLoader 不认识的新扩展名）在 `directory.loader.ts` 的 Map 里加一行

```typescript
['.json', new JsonLoader()],
```

完事。配置文件里改成 `RAG_LOADER=json` 就能用了。

### 10.2 加一个新的向量库（比如 Milvus）

**第 1 步**：创建 `src/rag/vector-stores/milvus.vector-store.ts`，实现 `IVectorStore` 接口

**第 2 步**：`rag.constants.ts` 加 `'milvus'` 到 `VectorStoreType`

**第 3 步**：`rag.module.ts` 的 `vectorStoreProvider` 加 `case 'milvus'`

其他零件（Retriever、Generator 等）同理。

---

## 十一、测试怎么跑

```bash
# 跑 RAG 相关的全部测试
npm run test -- --testPathPatterns=src/rag/

# 只跑内存向量库的测试
npm run test -- --testPathPatterns=src/rag/vector-stores/

# 跑全项目测试
npm run test
```

测试文件有两个：
- `memory.vector-store.spec.ts` — 测 MemoryVectorStore 的增删查
- `rag.spec.ts` — 测整个流水线的各个环节

测试全部用 Mock（假的实现），不调真实 API，所以不用配 API Key 也能跑。

---

## 十二、常见问题

### Q1: MemoryVectorStore 和 QdrantVectorStore 我该用哪个？

**开发/学习用 memory**。不用装 Docker，秒启动。但重启服务数据就没了。

**生产用 Qdrant**。需要先装 Docker 并启动：
```bash
docker run -d -p 6333:6333 -p 6334:6334 qdrant/qdrant
```
然后 `.env` 里设 `RAG_VECTOR_STORE=qdrant`。

### Q2: 为什么要切成小段，不直接把整个文档喂给大模型？

因为大模型有上下文长度限制（比如 8192 token ≈ 6000 中文字）。一个 10 万字的文档根本塞不进去。切成 500 字的小段后，每次只需喂最相关的 4 段（2000 字），既省 token 又提高了回答质量。

### Q3: chunkSize 设多大合适？

- **500**（默认）：通常够用，检索精度高
- **1000**：适合长段落，上下文更完整但可能混入无关内容
- **200**：太碎，丢失上下文

没有标准答案，看你的文档类型。偏 QA 的设大点，偏精确检索的设小点。

### Q4: 向量相似度怎么算的？

用的是**余弦相似度**（Cosine Similarity）。两个向量夹角越小（越"同方向"），值越接近 1，表示语义越接近。公式就是高中数学的向量点积除以模长乘积。

### Q5: /rag/search 和 /rag/query 有什么区别？

- **search**：只检索，返回文档原文片段。适合你只想看相关资料。
- **query**：检索 + 让大模型帮你总结回答。适合直接要答案。

### Q6: 流式接口怎么调？

用 curl 加 `-N` 参数（禁用缓冲），或者在 Postman 里选 **Send and Stream** 模式（最新版 Postman）。

---

## 十三、一句话总结每个文件

| 文件 | 一句话 |
|------|--------|
| `rag.constants.ts` | 定义 6 个"暗号"（DI token）+ 共享类型 |
| `rag.config.ts` | 可配置哪些参数 |
| `rag.module.ts` | 组装工厂，按配置选择实现 |
| `interfaces/*.ts` | 6 份"合同" |
| `loaders/txt.loader.ts` | 读 txt 文件 |
| `loaders/markdown.loader.ts` | 读 md 文件 |
| `loaders/pdf.loader.ts` | 读 pdf 文件 |
| `loaders/directory.loader.ts` | 读整个文件夹 |
| `splitters/recursive-text-splitter.ts` | 把长文档切成小段 |
| `embedders/openai-compatible.embedder.ts` | 调智谱 API 把文字转向量 |
| `vector-stores/memory.vector-store.ts` | 向量存内存 |
| `vector-stores/qdrant.vector-store.ts` | 向量存 Qdrant |
| `retrievers/similarity.retriever.ts` | 纯向量检索 |
| `retrievers/hybrid.retriever.ts` | 向量 + BM25 混合检索 |
| `generators/llm.generator.ts` | 调大模型生成回答 |
| `pipeline/ingestion.pipeline.ts` | 串联 Load→Split→Embed→Store |
| `pipeline/query.pipeline.ts` | 串联 Retrieve→Generate |
| `pipeline/pipeline.service.ts` | 对外门面 |
| `rag.controller.ts` | HTTP 接口 |
| `rag.cli.ts` | 命令行工具 |
| `dto/*.dto.ts` | 请求参数校验 |
| `rag.spec.ts` | 集成测试 |
| `memory.vector-store.spec.ts` | 内存向量库单元测试 |
