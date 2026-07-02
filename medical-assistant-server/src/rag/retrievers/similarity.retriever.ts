import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Document } from '../rag.constants';
import { VECTOR_STORE_TOKEN } from '../rag.constants';
import type { IRetriever } from '../interfaces/retriever.interface';
import type { IVectorStore } from '../interfaces/vector-store.interface';

/**
 * 纯向量相似度检索器
 *
 * 最简单的检索策略：把查询文本向量化后在向量库中搜 top-k。
 * 优点：能捕获语义相近但用词不同的内容。
 * 缺点：可能漏掉精确关键词匹配的结果。
 * 如果追求更好的召回率，建议使用 HybridRetriever。
 */
@Injectable()
export class SimilarityRetriever implements IRetriever {
  readonly name = 'similarity';

  constructor(
    @Inject(VECTOR_STORE_TOKEN) private readonly vectorStore: IVectorStore,
    private readonly config: ConfigService,
  ) {}

  async retrieve(query: string, k?: number, filter?: Record<string, unknown>): Promise<Document[]> {
    // k 参数优先使用调用方传入的值，没有则从配置读取（默认 4）
    const effectiveK = k ?? this.config.get<number>('RAG_RETRIEVAL_K', 4);
    return this.vectorStore.similaritySearch(query, effectiveK, filter);
  }
}
