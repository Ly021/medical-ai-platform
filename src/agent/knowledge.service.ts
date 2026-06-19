import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import * as fs from 'fs';
import * as path from 'path';

interface DocChunk {
  content: string;
  embedding: number[];
}

@Injectable()
export class KnowledgeService implements OnModuleInit {
  private chunks: DocChunk[] = [];
  private embeddings: OpenAIEmbeddings;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    // OpenAI SDK 会检查 OPENAI_API_KEY 环境变量，占位绕过
    if (!process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = 'placeholder';
    }

    const filePath = path.resolve('data/knowledge.txt');
    const text = fs.readFileSync(filePath, 'utf-8');

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 300,
      chunkOverlap: 50,
    });
    const docs = await splitter.createDocuments([text]);

    this.embeddings = new OpenAIEmbeddings({
      model: 'embedding-2',
      apiKey: this.config.get('ZHIPU_API_KEY'),
      timeout: 15_000,
      configuration: {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
      },
    });

    const vectors = await this.embeddings.embedDocuments(
      docs.map((d) => d.pageContent),
    );

    this.chunks = docs.map((doc, i) => ({
      content: doc.pageContent,
      embedding: vectors[i],
    }));

    console.log(`Knowledge base loaded: ${this.chunks.length} chunks`);
  }

  async search(query: string, k = 3): Promise<string> {
    const queryVec = await this.embeddings.embedQuery(query);

    const scored = this.chunks.map((chunk) => ({
      content: chunk.content,
      score: this.cosineSim(queryVec, chunk.embedding),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((item) => item.content)
      .join('\n---\n');
  }

  private cosineSim(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
