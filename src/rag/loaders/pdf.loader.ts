import { Injectable } from '@nestjs/common';
import type { Document } from '../rag.constants';
import type { ILoader } from '../interfaces/loader.interface';

/**
 * PDF 文件加载器
 *
 * 使用 LangChain 社区的 PDFLoader（底层依赖 pdf-parse 库）。
 * 采用动态 import 而非顶层 import，避免不装 pdf-parse 就无法启动整个应用。
 * 首次使用时才加载，如果缺少依赖会给出明确的安装提示。
 */
@Injectable()
export class PdfLoader implements ILoader {
  readonly name = 'pdf';

  async load(source: string): Promise<Document[]> {
    try {
      // 动态 import —— 只有真正调用 load() 时才加载 PDFLoader
      const { PDFLoader } = await import('@langchain/community/document_loaders/fs/pdf');
      const loader = new PDFLoader(source);
      return loader.load();
    } catch {
      throw new Error(
        'PDF loader requires pdf-parse. Install: npm install pdf-parse',
      );
    }
  }
}
