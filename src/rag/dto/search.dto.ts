import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

/**
 * 检索请求参数
 *
 * 示例：
 *   { "query": "NestJS依赖注入", "k": 5 }
 */
export class SearchDto {
  /** 查询关键词或问题（必填） */
  @IsString()
  query: string;

  /** 返回条数（可选，1-50，默认 4） */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  k?: number;
}
