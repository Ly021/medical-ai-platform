import { IsString, IsOptional } from 'class-validator';

/**
 * 入库请求参数
 *
 * 示例：
 *   { "source": "data/knowledge.txt" }
 *   { "source": "./data", "collection": "my_docs" }
 */
export class IngestDto {
  /** 文件路径或目录路径（必填） */
  @IsString()
  source: string;

  /** 集合名称（可选，目前为预留字段） */
  @IsOptional()
  @IsString()
  collection?: string;
}
