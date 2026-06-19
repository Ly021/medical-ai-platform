import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import type { IEmbedder } from '../interfaces/embedder.interface';

/**
 * OpenAI 兼容协议的向量化器
 *
 * 虽然叫 OpenAIEmbeddings，实际可以对接任何 OpenAI 兼容的 embedding API。
 * 本项目默认连接智谱（Zhipu）的 embedding-2 模型（1024 维）。
 *
 * timeout 设为 15 秒，防止网络异常时长时间挂起。
 *
 * 环境变量：
 * - EMBEDDING_MODEL: 模型名（默认 embedding-2）
 * - EMBEDDING_BASE_URL: API 地址（默认智谱地址）
 * - EMBEDDING_DIMENSIONS: 向量维度（默认 1024）
 */
@Injectable()
export class OpenAICompatibleEmbedder implements IEmbedder {
  readonly name = 'openai-compatible';
  readonly dimensions: number;

  private readonly embeddings: OpenAIEmbeddings;

  constructor(private readonly config: ConfigService) {
    const model = this.config.get<string>('EMBEDDING_MODEL', 'embedding-2');
    const apiKey = this.config.get<string>('ZHIPU_API_KEY');
    const baseURL = this.config.get<string>(
      'EMBEDDING_BASE_URL',
      'https://open.bigmodel.cn/api/paas/v4/',
    );

    this.embeddings = new OpenAIEmbeddings({
      model,
      apiKey,
      timeout: 15_000, // 15 秒超时，避免网络问题导致请求挂死
      configuration: { baseURL },
    });

    this.dimensions = this.config.get<number>('EMBEDDING_DIMENSIONS', 1024);
  }

  /** 批量向量化 —— 入库时把多个文档段落一次性转为向量 */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }

  /** 单句向量化 —— 查询时把用户问题转为向量 */
  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }
}
