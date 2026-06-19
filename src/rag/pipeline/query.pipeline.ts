import { Injectable, Inject } from '@nestjs/common';
import type { QueryResult, StreamChunk } from '../rag.constants';
import { RETRIEVER_TOKEN, GENERATOR_TOKEN } from '../rag.constants';
import type { IRetriever } from '../interfaces/retriever.interface';
import type { IGenerator } from '../interfaces/generator.interface';
import type { Document } from '../rag.constants';

/**
 * 查询流水线
 *
 * 编排问答的两个步骤：Retrieve → Generate
 *
 * 数据流：
 *   用户问题 → IRetriever（检索相关文档）→ Document[]
 *   → 拼 prompt → IGenerator（大模型生成）→ 回答
 *
 * 提供三种调用方式：
 * - query(): 检索 + 生成，一次性返回
 * - queryStream(): 检索 + 流式生成（SSE）
 * - search(): 仅检索，不生成（用于只想看原文的场景）
 */
@Injectable()
export class QueryPipeline {
  constructor(
    @Inject(RETRIEVER_TOKEN) private readonly retriever: IRetriever,
    @Inject(GENERATOR_TOKEN) private readonly generator: IGenerator,
  ) {}

  /** 非流式问答：检索 → 生成 → 返回完整结果 */
  async query(input: string): Promise<QueryResult> {
    const context = await this.retriever.retrieve(input);
    const answer = await this.generator.generate(input, context);
    return { answer, sources: context };
  }

  /**
   * 流式问答：检索 → 逐字生成（SSE 推送）
   *
   * yield 的顺序：
   *   1. status: "正在检索相关文档..."
   *   2. status: "找到 N 个相关文档，正在生成回答..."
   *   3. chunk × N: 逐 token 输出
   *   4. done: 生成结束
   */
  async *queryStream(input: string): AsyncGenerator<StreamChunk> {
    yield { type: 'status', content: '正在检索相关文档...' };

    const context = await this.retriever.retrieve(input);
    yield { type: 'status', content: `找到 ${context.length} 个相关文档，正在生成回答...` };

    // yield* 把 generator 的产出原样转发给调用方
    yield* this.generator.generateStream(input, context);
  }

  /** 纯检索：只返回相关文档，不调大模型 */
  async search(query: string, k?: number): Promise<Document[]> {
    return this.retriever.retrieve(query, k);
  }
}
