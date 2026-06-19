import type { Document } from '@langchain/core/documents';

export type { Document };

// ============================================================
// DI Injection Tokens（依赖注入的"暗号"）
// ============================================================
// NestJS 中字符串 token 比 class token 更灵活：
// 多个实现可以共用同一个 token，调用方不需要知道具体是哪个类。
// 例如 @Inject(VECTOR_STORE_TOKEN) 拿到的可能是 MemoryVectorStore 或 QdrantVectorStore，
// 取决于 RagModule.register() 时的配置。

/** 文档加载器 token */
export const LOADER_TOKEN = 'RAG_LOADER';
/** 文本分割器 token */
export const SPLITTER_TOKEN = 'RAG_SPLITTER';
/** 向量化器 token */
export const EMBEDDER_TOKEN = 'RAG_EMBEDDER';
/** 向量存储 token */
export const VECTOR_STORE_TOKEN = 'RAG_VECTOR_STORE';
/** 检索器 token */
export const RETRIEVER_TOKEN = 'RAG_RETRIEVER';
/** 生成器 token */
export const GENERATOR_TOKEN = 'RAG_GENERATOR';

// ============================================================
// Stage Type Identifiers（每个阶段支持哪些实现）
// ============================================================
// 这些联合类型用于配置类型检查。在 rag.module.ts 的 switch 语句中，
// 如果你写了不支持的类型，TypeScript 会报错。

export type LoaderType = 'txt' | 'markdown' | 'pdf' | 'directory';
export type SplitterType = 'recursive';
export type EmbedderType = 'openai-compatible';
export type VectorStoreType = 'qdrant' | 'memory';
export type RetrieverType = 'similarity' | 'hybrid';
export type GeneratorType = 'llm';

// ============================================================
// Shared Data Types（跨阶段共享的数据结构）
// ============================================================

/** SSE 流式输出的单个事件 */
export interface StreamChunk {
  type: 'chunk' | 'status' | 'done' | 'error';
  content?: string;
}

/** 入库流水线的返回结果 */
export interface IngestionResult {
  sourceDocuments: number; // 原始文档数
  chunks: number;          // 分段数
  ids: string[];           // 所有分段的唯一 ID
}

/** 问答流水线的返回结果 */
export interface QueryResult {
  answer: string;         // 大模型生成的回答
  sources: Document[];    // 引用的参考文档
}
