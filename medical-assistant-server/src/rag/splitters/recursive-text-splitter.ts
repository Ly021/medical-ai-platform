import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Document } from '../rag.constants';
import type { ITextSplitter } from '../interfaces/splitter.interface';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/**
 * 递归文本分割器
 *
 * 切分优先级：段落 → 句子 → 单词 → 字符。
 * 尽量在自然边界断开，避免生硬截断。
 *
 * 配置项（.env 或代码传参）：
 * - RAG_CHUNK_SIZE: 每段最大字符数（默认 500）
 * - RAG_CHUNK_OVERLAP: 相邻段重叠字符数（默认 50）
 *   重叠可以防止关键信息刚好被切在边界上而丢失上下文。
 */
@Injectable()
export class RecursiveTextSplitter implements ITextSplitter {
  readonly name = 'recursive';
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(private readonly config: ConfigService) {
    this.chunkSize = this.config.get<number>('RAG_CHUNK_SIZE', 500);
    this.chunkOverlap = this.config.get<number>('RAG_CHUNK_OVERLAP', 50);
  }

  async splitDocuments(docs: Document[]): Promise<Document[]> {
    // 每次调用都 new 一个 splitter，因为 LangChain 的 splitter 是有状态的
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });
    return splitter.splitDocuments(docs);
  }
}
