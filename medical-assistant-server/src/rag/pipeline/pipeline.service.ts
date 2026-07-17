import { Injectable, Inject } from '@nestjs/common';
import type { Document, IngestionResult, QueryResult, StreamChunk, DocumentInfo } from '../rag.constants';
import { VECTOR_STORE_TOKEN } from '../rag.constants';
import type { IVectorStore } from '../interfaces/vector-store.interface';
import { IngestionPipeline } from './ingestion.pipeline';
import { QueryPipeline } from './query.pipeline';

/**
 * 流水线门面（Facade）
 *
 * 对外暴露统一接口，内部委托给 IngestionPipeline / QueryPipeline。
 */
@Injectable()
export class PipelineService {
  constructor(
    private readonly ingestion: IngestionPipeline,
    private readonly queryPipeline: QueryPipeline,
    @Inject(VECTOR_STORE_TOKEN) private readonly vectorStore: IVectorStore,
  ) {}

  /** 文档入库 */
  async ingest(source: string): Promise<IngestionResult> {
    return this.ingestion.ingest(source);
  }

  /** 预览分段效果（不入库） */
  async preview(source: string): Promise<Document[]> {
    return this.ingestion.preview(source);
  }

  /** 非流式问答 */
  async query(input: string): Promise<QueryResult> {
    return this.queryPipeline.query(input);
  }

  /** 流式问答 */
  async *queryStream(input: string): AsyncGenerator<StreamChunk> {
    yield* this.queryPipeline.queryStream(input);
  }

  /** 纯检索 */
  async search(q: string, k?: number): Promise<Document[]> {
    return this.queryPipeline.search(q, k);
  }

  /** 列出所有已入库文档，按 source 聚合 */
  async getAllDocuments(): Promise<DocumentInfo[]> {
    const entries = await this.vectorStore.getAllDocuments();
    const map = new Map<string, { ids: string[] }>();
    for (const entry of entries) {
      const source = (entry.metadata?.source as string) ?? 'unknown';
      if (!map.has(source)) map.set(source, { ids: [] });
      map.get(source)!.ids.push(entry.id);
    }
    return Array.from(map.entries()).map(([source, group]) => ({
      source,
      filename: source.split(/[\\/]/).pop() ?? source,
      chunks: group.ids.length,
      ids: group.ids,
    }));
  }

  /** 按分段 ID 删除文档 */
  async deleteDocuments(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.vectorStore.delete({ ids });
  }
}
