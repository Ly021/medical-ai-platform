import type { Document } from '../rag.constants';

/**
 * 文本分割器接口
 *
 * 大模型的上下文窗口有限，长文档必须先切成小段才能喂进去。
 * 每个实现类可以有不同的切分策略 —— 按段落、按句子、按固定长度等。
 */
export interface ITextSplitter {
  /** 分割器唯一标识，如 "recursive" */
  readonly name: string;

  /**
   * 将一批文档切分成更小的片段
   * @param docs - 原始文档数组
   * @returns 切分后的片段数组（数量 ≥ 输入数量）
   */
  splitDocuments(docs: Document[]): Promise<Document[]>;
}
