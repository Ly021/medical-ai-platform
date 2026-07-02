import { IsString, IsOptional } from 'class-validator';

/**
 * 问答请求参数
 *
 * 示例：
 *   { "question": "什么是LangChain Agent" }
 *   { "question": "它有什么优势", "history": "上一轮：什么是LangChain Agent\n回答：..." }
 */
export class QueryDto {
  /** 用户问题（必填） */
  @IsString()
  question: string;

  /** 历史对话文本（可选，用于多轮对话） */
  @IsOptional()
  @IsString()
  history?: string;
}
