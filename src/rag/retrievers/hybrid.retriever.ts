import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Document } from '../rag.constants';
import { VECTOR_STORE_TOKEN } from '../rag.constants';
import type { IRetriever } from '../interfaces/retriever.interface';
import type { IVectorStore } from '../interfaces/vector-store.interface';

/**
 * 混合检索器：向量相似度 + BM25 关键词，RRF 融合
 *
 * 策略：
 * 1. 先从向量库拉 2*k 条候选（扩大召回范围）
 * 2. 对候选文档跑 BM25 关键词打分（弥补向量检索可能漏掉的精确匹配）
 * 3. 用加权公式合并两个分数：combined = α × 向量分 + (1-α) × BM25 分
 *
 * 环境变量：
 * - RAG_HYBRID_ALPHA: 向量得分权重（默认 0.7），0 = 纯关键词，1 = 纯向量
 */
@Injectable()
export class HybridRetriever implements IRetriever {
  readonly name = 'hybrid';

  constructor(
    @Inject(VECTOR_STORE_TOKEN) private readonly vectorStore: IVectorStore,
    private readonly config: ConfigService,
  ) {}

  async retrieve(query: string, k = 4, filter?: Record<string, unknown>): Promise<Document[]> {
    // 先拉 2 倍数量，给融合阶段留出筛选空间
    const fetchK = k * 2;
    const vectorResults = await this.vectorStore.similaritySearch(query, fetchK, filter);

    // 对候选文档做 BM25 关键词打分
    const bm25Scores = this.bm25Score(query, vectorResults);

    // RRF 加权融合
    const alpha = this.config.get<number>('RAG_HYBRID_ALPHA', 0.7);
    return vectorResults
      .map((doc) => {
        const id = (doc.metadata._id ?? doc.pageContent.slice(0, 32)) as string;
        const vecScore = (doc.metadata._score as number) ?? 0;
        const bmScore = bm25Scores.get(id) ?? 0;
        // 加权求和：alpha 控制向量得分占比
        const combined = alpha * vecScore + (1 - alpha) * bmScore;
        doc.metadata._score = combined;
        return doc;
      })
      .sort((a, b) => (b.metadata._score as number) - (a.metadata._score as number))
      .slice(0, k); // 融合后取 top-k
  }

  /**
   * 朴素 BM25 打分
   *
   * BM25 是经典的关键词匹配算法，核心思想：
   * - 词频（TF）越高，得分越高（但饱和曲线防止刷分）
   * - 文档频率（DF）越高（该词在很多文档出现），说明区分度低，权重降低（IDF）
   * - 文档越长，词频贡献稀释越多（长度归一化）
   */
  private bm25Score(query: string, docs: Document[]): Map<string, number> {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const scores = new Map<string, number>();

    // 平均文档长度（用于长度归一化）
    const avgdl = docs.reduce((sum, d) => sum + d.pageContent.length, 0) / (docs.length || 1);
    const k1 = 1.5; // TF 饱和参数
    const b = 0.75;  // 长度归一化参数

    for (const doc of docs) {
      const dl = doc.pageContent.length;
      const words = doc.pageContent.toLowerCase().split(/\s+/);

      // 统计每个词在该文档中出现的次数（Term Frequency）
      const tf: Record<string, number> = {};
      for (const w of words) tf[w] = (tf[w] || 0) + 1;

      let score = 0;
      for (const term of queryTerms) {
        const f = tf[term] || 0;
        if (f === 0) continue;

        // 计算 IDF（Inverse Document Frequency）
        const df = docs.filter((d) =>
          d.pageContent.toLowerCase().includes(term),
        ).length;
        const idf = Math.log((docs.length - df + 0.5) / (df + 0.5) + 1);

        // BM25 核心公式
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgdl))));
      }

      const id = (doc.metadata._id ?? doc.pageContent.slice(0, 32)) as string;
      scores.set(id, score);
    }
    return scores;
  }
}
