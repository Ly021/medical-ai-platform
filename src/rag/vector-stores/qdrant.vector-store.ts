import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantVectorStore as LangChainQdrant } from '@langchain/qdrant';
import type { Document } from '../rag.constants';
import { EMBEDDER_TOKEN } from '../rag.constants';
import type { IVectorStore } from '../interfaces/vector-store.interface';
import type { IEmbedder } from '../interfaces/embedder.interface';

/**
 * Qdrant 向量存储（生产环境推荐）
 *
 * Qdrant 是一个开源向量数据库，基于 HNSW 算法做近似最近邻搜索，
 * 比 MemoryVectorStore 的暴力搜索快几个数量级。
 *
 * 启动前需要先运行 Qdrant 服务：
 *   docker run -d -p 6333:6333 -p 6334:6334 qdrant/qdrant
 *
 * 环境变量：
 * - QDRANT_URL: Qdrant 服务地址（默认 http://localhost:6333）
 * - QDRANT_COLLECTION: 集合名称（默认 rag_docs）
 */
@Injectable()
export class QdrantVectorStore implements IVectorStore, OnModuleInit {
  readonly name = 'qdrant';

  private store: LangChainQdrant;
  private readonly collectionName: string;
  private readonly url: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(EMBEDDER_TOKEN) private readonly embedder: IEmbedder,
  ) {
    this.url = this.config.get<string>('QDRANT_URL', 'http://localhost:6333');
    this.collectionName = this.config.get<string>('QDRANT_COLLECTION', 'rag_docs');
  }

  /**
   * 模块初始化时自动执行 —— 确保 Qdrant 中已存在目标 collection。
   * 如果不存在则自动创建，已存在则复用。
   */
  onModuleInit() {
    this.ensureCollection(this.collectionName, this.embedder.dimensions).catch((err) => {
      console.error('[QdrantVectorStore] 初始化失败:', err);
    });
  }

  async ensureCollection(_collectionName: string, _vectorSize: number): Promise<void> {
    try {
      // 尝试连接已有 collection
      this.store = await LangChainQdrant.fromExistingCollection(
        this.embedder as any, // LangChain Qdrant 的 embedder 类型与我们的 IEmbedder 不兼容，用 as any 桥接
        { url: this.url, collectionName: this.collectionName },
      );
    } catch {
      // collection 不存在 → 用空数据创建新 collection
      this.store = await LangChainQdrant.fromTexts([], [], this.embedder as any, {
        url: this.url,
        collectionName: this.collectionName,
      });
    }
  }

  async addDocuments(docs: Document[], options?: { ids?: string[] }): Promise<void> {
    await this.store.addDocuments(docs, options);
  }

  async addVectors(vectors: number[][], docs: Document[], options?: { ids?: string[] }): Promise<void> {
    await this.store.addVectors(vectors, docs, options);
  }

  async similaritySearch(query: string, k = 4, filter?: Record<string, unknown>): Promise<Document[]> {
    return this.store.similaritySearch(query, k, filter);
  }

  async similaritySearchVector(embedding: number[], k = 4, filter?: Record<string, unknown>): Promise<Document[]> {
    // Qdrant 的 similaritySearchVectorWithScore 返回 [Document, number] 元组
    const results = await this.store.similaritySearchVectorWithScore(embedding, k, filter);
    return results.map(([doc]) => doc);
  }

  async delete(params: { ids?: string[]; filter?: Record<string, unknown> }): Promise<void> {
    if (params.ids?.length) {
      await this.store.delete({ ids: params.ids, filter: params.filter as any });
    } else if (params.filter) {
      await this.store.delete({ filter: params.filter as any });
    }
  }
}
