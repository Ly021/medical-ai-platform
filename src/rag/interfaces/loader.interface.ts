import type { Document } from '../rag.constants';

/**
 * 文档加载器接口
 *
 * 每种文件格式（txt、pdf、markdown 等）各写一个实现类，
 * 通过 `RagModule` 的工厂函数按配置切换。
 *
 * `source` 的语义由实现类自己定义 —— 通常是文件路径，也可以是 URL 或目录路径。
 */
export interface ILoader {
  /** 加载器唯一标识，如 "txt"、"pdf"、"directory" */
  readonly name: string;

  /**
   * 从数据源加载文档
   * @param source - 文件路径 / URL / 目录路径（由实现类定义）
   * @returns 解析后的文档数组（可能为空）
   */
  load(source: string): Promise<Document[]>;
}
