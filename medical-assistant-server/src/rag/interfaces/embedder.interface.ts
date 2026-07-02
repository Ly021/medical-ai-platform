/**
 * 向量化器接口
 *
 * 把文本转成浮点数数组（向量 / embedding），这是 RAG 检索的核心。
 * 语义相近的文本，它们的向量在空间中方向也相近（余弦相似度衡量）。
 *
 * 默认使用智谱 Embedding-2 模型（OpenAI 兼容协议，1024 维）。
 */
export interface IEmbedder {
  /** 向量化器唯一标识，如 "openai-compatible" */
  readonly name: string;

  /** 输出向量的维度（如 1024） */
  readonly dimensions: number;

  /**
   * 批量向量化（入库用，一次处理多个文档片段）
   * @param texts - 文本数组
   * @returns 每个文本对应的向量（长度 = texts.length）
   */
  embedDocuments(texts: string[]): Promise<number[][]>;

  /**
   * 单句向量化（查询用，只向量化用户问题）
   * @param text - 单个查询文本
   * @returns 该文本的向量
   */
  embedQuery(text: string): Promise<number[]>;
}
