import type { Document } from '../rag.constants';

/**
 * 检索器接口
 *
 * 封装"从向量库检索相关文档"的策略。
 * SimilarityRetriever 做纯向量检索，HybridRetriever 加入 BM25 关键词做混合检索。
 */
export interface IRetriever {
  /** 检索器唯一标识，如 "similarity"、"hybrid" */
  readonly name: string;

  /**
   * 根据查询文本检索最相关的文档
   * @param query - 用户输入的问题或关键词
   * @param k - 返回前 k 条结果（默认 4）
   * @param filter - 可选，按 metadata 字段过滤
   * @returns 按相关性降序排列的文档数组
   */
  retrieve(query: string, k?: number, filter?: Record<string, unknown>): Promise<Document[]>;
}
