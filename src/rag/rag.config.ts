import type { LoaderType, SplitterType, EmbedderType, VectorStoreType, RetrieverType, GeneratorType } from './rag.constants';

/**
 * RAG 模块的可配置参数
 *
 * 传给 `RagModule.register(options)` 的所有可选字段。
 * 不传就用环境变量或默认值。
 */
export interface RagModuleOptions {
  /** 文档加载器类型（默认 "txt"） */
  loader?: LoaderType;
  /** 文本分割器类型（默认 "recursive"） */
  splitter?: SplitterType;
  /** 向量化器类型（默认 "openai-compatible"） */
  embedder?: EmbedderType;
  /** 向量存储类型（默认 "memory"） */
  vectorStore?: VectorStoreType;
  /** 检索器类型（默认 "similarity"） */
  retriever?: RetrieverType;
  /** 生成器类型（默认 "llm"） */
  generator?: GeneratorType;

  /** 分段大小（字符数，默认 500） */
  chunkSize?: number;
  /** 分段重叠大小（字符数，默认 50） */
  chunkOverlap?: number;
  /** 检索返回数量（默认 4） */
  retrievalK?: number;
}
