import { Injectable, Inject } from '@nestjs/common';
import type { Document } from '../rag.constants';
import { EMBEDDER_TOKEN } from '../rag.constants';
import type { IVectorStore } from '../interfaces/vector-store.interface';
import type { IEmbedder } from '../interfaces/embedder.interface';

/** 内存中的一条向量记录 */
interface VectorEntry {
  id: string;
  vector: number[];
  doc: Document;
}

/**
 * 内存向量存储（开发 / 测试用）
 *
 * 所有数据存在内存数组中，服务重启即丢失。
 * 相似度搜索使用暴力余弦相似度 —— 遍历所有向量逐一计算，O(n) 复杂度。
 * 数据量小时足够快，数据量大时请切换到 QdrantVectorStore。
 *
 * 不需要任何外部依赖，开箱即用。
 */
@Injectable()
export class MemoryVectorStore implements IVectorStore {
  readonly name = 'memory';

  /** 向量条目数组 —— 这就是我们的"数据库" */
  private entries: VectorEntry[] = [];

  constructor(@Inject(EMBEDDER_TOKEN) private readonly embedder: IEmbedder) {}

  /** 内存存储无需建表，空实现 */
  async ensureCollection(): Promise<void> {}

  /**
   * 添加文档（自动向量化）
   * 内部先调 embedder 把文本转成向量，再存入内存数组
   */
  async addDocuments(docs: Document[], options?: { ids?: string[] }): Promise<void> {
    const texts = docs.map((d) => d.pageContent);
    const vectors = await this.embedder.embedDocuments(texts);
    await this.addVectors(vectors, docs, options);
  }

  /**
   * 直接添加向量 + 文档
   * 入库流水线已经在上游算好了向量，所以直接用这个方法
   */
  async addVectors(vectors: number[][], docs: Document[], options?: { ids?: string[] }): Promise<void> {
    // 如果没有传 ids，自动生成时间戳 + 序号作为临时 ID
    const ids = options?.ids ?? docs.map((_, i) => `mem_${Date.now()}_${i}`);
    for (let i = 0; i < docs.length; i++) {
      this.entries.push({ id: ids[i], vector: vectors[i], doc: docs[i] });
    }
  }

  /** 按文本查询 —— 内部先把文本向量化，再走向量搜索 */
  async similaritySearch(query: string, k = 4): Promise<Document[]> {
    const queryVec = await this.embedder.embedQuery(query);
    return this.similaritySearchVector(queryVec, k);
  }

  /** 按向量查询 —— 计算余弦相似度后排序返回 top-k */
  async similaritySearchVector(embedding: number[], k = 4): Promise<Document[]> {
    return this.entries
      .map((e) => ({
        doc: e.doc,
        score: this.cosineSim(embedding, e.vector),
      }))
      .sort((a, b) => b.score - a.score) // 降序：相似度高的排前面
      .slice(0, k)
      .map((item) => {
        // 把相似度分数写入 metadata，调用方可以从 doc.metadata._score 读取
        item.doc.metadata._score = item.score;
        return item.doc;
      });
  }

  /** 按 ID 删除 */
  async delete(params: { ids?: string[] }): Promise<void> {
    if (params.ids) {
      const idSet = new Set(params.ids);
      this.entries = this.entries.filter((e) => !idSet.has(e.id));
    }
  }

  /**
   * 余弦相似度计算
   *
   * 公式：cos(a, b) = dot(a, b) / (||a|| * ||b||)
   * 值域 [-1, 1]，越接近 1 表示两个向量方向越一致（语义越相近）。
   * 返回值为 0 当且仅当除数为 0（零向量）。
   */
  private cosineSim(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB)) || 0;
  }
}
