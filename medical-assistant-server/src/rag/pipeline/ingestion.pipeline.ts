import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Document, IngestionResult } from '../rag.constants';
import { LOADER_TOKEN, SPLITTER_TOKEN, EMBEDDER_TOKEN, VECTOR_STORE_TOKEN } from '../rag.constants';
import type { ILoader } from '../interfaces/loader.interface';
import type { ITextSplitter } from '../interfaces/splitter.interface';
import type { IEmbedder } from '../interfaces/embedder.interface';
import type { IVectorStore } from '../interfaces/vector-store.interface';

/**
 * 入库流水线
 *
 * 编排文档入库的四个步骤：Load → Split → Embed → Store
 *
 * 数据流：
 *   硬盘文件 → ILoader（读取）→ Document[]（原始文档）
 *   → ITextSplitter（切段）→ Document[]（小段）
 *   → IEmbedder（向量化）→ number[][]（向量）
 *   → IVectorStore（存储）→ 持久化
 *
 * 每个步骤的具体实现由 RagModule 根据配置注入，本类只负责编排调度。
 */
@Injectable()
export class IngestionPipeline {
  constructor(
    @Inject(LOADER_TOKEN) private readonly loader: ILoader,
    @Inject(SPLITTER_TOKEN) private readonly splitter: ITextSplitter,
    @Inject(EMBEDDER_TOKEN) private readonly embedder: IEmbedder,
    @Inject(VECTOR_STORE_TOKEN) private readonly vectorStore: IVectorStore,
  ) {}

  /**
   * 完整入库流程
   * @param source - 文件路径或目录路径（传给 loader）
   * @returns 入库结果摘要（源文档数、分段数、ID 列表）
   */
  async ingest(source: string): Promise<IngestionResult> {
    console.log('=== ingest start ===', source);

    const docs = await this.loader.load(source);
    console.log('Step 1 - loaded', docs.length, 'docs');
    console.log('  first doc snippet:', docs[0]?.pageContent?.substring(0, 100));

    const chunks = await this.splitter.splitDocuments(docs);
    console.log('Step 2 - split into', chunks.length, 'chunks');
    console.log('  first chunk:', chunks[0]?.pageContent?.substring(0, 100));

    const ids = chunks.map(() => randomUUID());
    console.log('Step 3 - generated ids:', ids.slice(0, 3));

    const texts = chunks.map((c) => c.pageContent);
    const vectors = await this.embedder.embedDocuments(texts);
    console.log('Step 4 - embedded', vectors.length, 'vectors, dim:', vectors[0]?.length);

    await this.vectorStore.addVectors(vectors, chunks, { ids });
    console.log('Step 5 - stored. Done.');

    return { sourceDocuments: docs.length, chunks: chunks.length, ids };
  }
  /**
   * 预览模式：只执行 Load + Split，不 Embed + Store
   * 用于在入库前预览分段效果，避免浪费 API 调用和存储空间
   */
  async preview(source: string): Promise<Document[]> {
    const docs = await this.loader.load(source);
    return this.splitter.splitDocuments(docs);
  }
}
