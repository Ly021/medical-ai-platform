import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import type { Document, StreamChunk } from '../rag.constants';
import type { IGenerator } from '../interfaces/generator.interface';

/**
 * LLM 生成器
 *
 * 把"用户问题 + 检索到的参考文档"组装成 prompt，调用大模型生成回答。
 * 默认使用阿里云百炼 qwen-turbo（通过 OpenAI 兼容协议）。
 *
 * 两种模式：
 * - generate(): 等模型输出完毕一次性返回
 * - generateStream(): 逐 token 流式输出（配合 SSE 推送给前端）
 *
 * 环境变量：
 * - LLM_MODEL: 模型名（默认 qwen-turbo）
 * - LLM_TEMPERATURE: 温度（默认 0.3，越低越确定性）
 * - LLM_BASE_URL: API 地址
 */
@Injectable()
export class LlmGenerator implements IGenerator, OnModuleInit {
  readonly name = 'llm';

  private model: ChatOpenAI;

  constructor(private readonly config: ConfigService) {}

  /** 模块初始化时创建模型实例 */
  onModuleInit() {
    this.model = new ChatOpenAI({
      model: this.config.get<string>('LLM_MODEL', 'qwen-turbo'),
      temperature: this.config.get<number>('LLM_TEMPERATURE', 0.3),
      apiKey: this.config.get<string>('DASHSCOPE_API_KEY'),
      configuration: {
        baseURL: this.config.get<string>(
          'LLM_BASE_URL',
          'https://dashscope.aliyuncs.com/compatible-mode/v1',
        ),
      },
    });
  }

  /** 非流式生成 —— 等待模型全部输出后返回完整回答 */
  async generate(query: string, context: Document[], conversationHistory?: string): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    // 如果有历史对话，拼在用户问题前
    if (conversationHistory) {
      messages.push({ role: 'user', content: conversationHistory });
    }
    messages.push({ role: 'user', content: query });

    const response = await this.model.invoke(messages as any);
    return typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
  }

  /** 流式生成 —— 逐 token 产出，适合 SSE 推送给前端实时显示 */
  async *generateStream(
    query: string,
    context: Document[],
    conversationHistory?: string,
  ): AsyncGenerator<StreamChunk> {
    const systemPrompt = this.buildSystemPrompt(context);
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    if (conversationHistory) {
      messages.push({ role: 'user', content: conversationHistory });
    }
    messages.push({ role: 'user', content: query });

    try {
      const stream = await this.model.stream(messages as any);
      for await (const chunk of stream) {
        if (chunk.content) {
          yield { type: 'chunk', content: chunk.content as string };
        }
      }
      yield { type: 'done' }; // 流结束信号
    } catch (err) {
      yield { type: 'error', content: String(err) };
    }
  }

  /**
   * 构建 RAG 系统提示词
   *
   * 将检索到的参考文档编号后嵌入 system prompt，
   * 告诉模型"请根据这些参考资料回答，不知道就说不知道"。
   * 这样可以大幅减少幻觉。
   */
  private buildSystemPrompt(context: Document[]): string {
    const contextText = context
      .map((doc, i) => `[文档${i + 1}]\n${doc.pageContent}`)
      .join('\n\n');
    return [
      '你是一个知识库助手。请根据以下参考资料回答用户问题。',
      '如果参考资料中没有相关信息，请如实告知用户。',
      '请用中文回答。',
      '',
      '参考资料：',
      contextText,
    ].join('\n');
  }
}
