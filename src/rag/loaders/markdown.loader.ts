import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { Document } from '@langchain/core/documents';
import type { ILoader } from '../interfaces/loader.interface';

/**
 * Markdown 文件加载器
 *
 * 读取 .md 文件并在 metadata 中标记 format 为 'markdown'，
 * 方便下游（如 splitter）针对不同格式做差异化处理。
 */
@Injectable()
export class MarkdownLoader implements ILoader {
  readonly name = 'markdown';

  async load(source: string): Promise<Document[]> {
    const content = fs.readFileSync(source, 'utf-8');
    return [new Document({ pageContent: content, metadata: { source, format: 'markdown' } })];
  }
}
