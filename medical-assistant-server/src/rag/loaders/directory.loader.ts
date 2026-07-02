import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import type { Document } from '../rag.constants';
import type { ILoader } from '../interfaces/loader.interface';
import { TxtLoader } from './txt.loader';
import { MarkdownLoader } from './markdown.loader';
import { PdfLoader } from './pdf.loader';

/**
 * 目录加载器
 *
 * 递归遍历目录，根据文件扩展名自动选择对应的 Loader。
 * 内部维护一个 扩展名 → Loader 的映射表，新增文件格式只需在 Map 里加一行。
 *
 * 使用示例：
 * - `RAG_LOADER=directory` + 请求 `{ "source": "./data" }`
 * - 目录下所有 .txt / .md / .pdf 文件都会被加载
 */
@Injectable()
export class DirectoryLoader implements ILoader {
  readonly name = 'directory';

  /** 扩展名 → 加载器实例的映射表 */
  private readonly loaders: Map<string, ILoader>;

  constructor(private readonly config: ConfigService) {
    // 注册支持的文件类型
    this.loaders = new Map<string, ILoader>([
      ['.txt', new TxtLoader()],
      ['.md', new MarkdownLoader()],
      ['.pdf', new PdfLoader()],
    ]);
  }

  async load(source: string): Promise<Document[]> {
    const allDocs: Document[] = [];
    await this.walkDir(source, allDocs);
    return allDocs;
  }

  /**
   * 递归遍历目录
   * 遇到子目录就深入，遇到文件就用对应的 loader 读取
   */
  private async walkDir(dir: string, allDocs: Document[]): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // 目录 → 递归进入
        await this.walkDir(full, allDocs);
      } else {
        // 文件 → 按扩展名找 loader
        const ext = path.extname(entry.name).toLowerCase();
        const loader = this.loaders.get(ext);
        if (loader) {
          const docs = await loader.load(full);
          // 统一修正 source 为文件的绝对路径
          docs.forEach((d) => {
            d.metadata.source = full;
          });
          allDocs.push(...docs);
        }
        // 未注册的扩展名静默跳过（如 .jpg、.json）
      }
    }
  }
}
