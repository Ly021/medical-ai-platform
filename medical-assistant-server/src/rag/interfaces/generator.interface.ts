import type { Document, StreamChunk } from '../rag.constants';

/**
 * 生成器接口
 *
 * 负责把"用户问题 + 检索到的参考文档"拼成 prompt，调用大模型生成最终回答。
 * 支持两种模式：一次性返回（generate）和逐字流式输出（generateStream）。
 */
export interface IGenerator {
  /** 生成器唯一标识，如 "llm" */
  readonly name: string;

  /**
   * 非流式生成（等模型全部输出完再返回）
   * @param query - 用户问题
   * @param context - 检索到的参考文档
   * @param conversationHistory - 可选，历史对话文本
   * @returns 完整的回答字符串
   */
  generate(query: string, context: Document[], conversationHistory?: string): Promise<string>;

  /**
   * 流式生成（一个字一个字往外蹦，适合 SSE 推送给前端）
   * @param query - 用户问题
   * @param context - 检索到的参考文档
   * @param conversationHistory - 可选，历史对话文本
   * @returns 异步生成器，逐个产出 StreamChunk
   */
  generateStream(
    query: string,
    context: Document[],
    conversationHistory?: string,
  ): AsyncGenerator<StreamChunk>;
}
