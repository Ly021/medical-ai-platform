import type { Document } from '../rag.constants';

/**
 * 向量存储接口
 *
 * 负责持久化向量 + 原始文档，并提供相似度搜索。
 * 内存版（MemoryVectorStore）用于开发测试，Qdrant 版用于生产。
 *
 * 注意：addDocuments / addVectors 都返回 void，不返回 ID 列表。
 * 如果需要记录 ID，调用方应在外部生成后通过 options.ids 传入。
 */
export interface IVectorStore {
  /** 存储后端唯一标识，如 "memory"、"qdrant" */
  readonly name: string;

  /**
   * 添加文档（内部自动调 embedder 做向量化后再存）
   * @param docs - 文档数组
   * @param options.ids - 可选，指定每个文档的唯一 ID
   */
  addDocuments(docs: Document[], options?: { ids?: string[] }): Promise<void>;

  /**
   * 直接添加向量 + 文档（入库流水线用此方法，因为上游已经做好向量化）
   * @param vectors - 向量数组，vectors[i] 对应 docs[i]
   * @param docs - 文档数组
   * @param options.ids - 可选，指定每个文档的唯一 ID
   */
  addVectors(vectors: number[][], docs: Document[], options?: { ids?: string[] }): Promise<void>;

  /**
   * 按文本查询（内部先向量化再搜）
   * @param query - 查询文本
   * @param k - 返回前 k 条（默认 4）
   * @param filter - 可选，按 metadata 字段过滤
   */
  similaritySearch(query: string, k?: number, filter?: Record<string, unknown>): Promise<Document[]>;

  /**
   * 按向量查询（跳过内部向量化，直接用外部已算好的向量搜）
   * @param embedding - 查询向量
   * @param k - 返回前 k 条（默认 4）
   * @param filter - 可选，按 metadata 字段过滤
   */
  similaritySearchVector(embedding: number[], k?: number, filter?: Record<string, unknown>): Promise<Document[]>;

  /**
   * 删除文档
   * @param params.ids - 按 ID 删除
   * @param params.filter - 按条件删除
   */
  delete(params: { ids?: string[]; filter?: Record<string, unknown> }): Promise<void>;

  /**
   * 确保集合/表存在（Qdrant 需要预先创建 collection）
   * @param collectionName - 集合名称
   * @param vectorSize - 向量维度
   */
  ensureCollection(collectionName: string, vectorSize: number): Promise<void>;

  /** 获取所有已存储的文档条目（id + metadata，不含向量和正文） */
  getAllDocuments(): Promise<Array<{ id: string; metadata: Record<string, unknown> }>>;
}
