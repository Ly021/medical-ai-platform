import { Injectable } from '@nestjs/common';
import type { Document, IngestionResult, QueryResult, StreamChunk } from '../rag.constants';
import { IngestionPipeline } from './ingestion.pipeline';
import { QueryPipeline } from './query.pipeline';

/**
 * 流水线门面（Facade）
 *
 * 对外暴露统一接口，内部委托给 IngestionPipeline / QueryPipeline。
 *
 * 这个"门面"模式的好处：
 * - 调用方只需注入 PipelineService，不需要分别注入两个 Pipeline
 * - 如果将来要加入更多流水线（如更新、删除），加在这里即可
 */
@Injectable()
export class PipelineService {
  constructor(
    private readonly ingestion: IngestionPipeline,
    private readonly queryPipeline: QueryPipeline,
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
}
