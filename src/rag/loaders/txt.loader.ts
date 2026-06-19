import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { Document } from '@langchain/core/documents';
import type { ILoader } from '../interfaces/loader.interface';

/**
 * 纯文本文件加载器
 *
 * 直接读取整个 .txt 文件，包装成一个 Document 对象。
 * 最简单、最常用的 loader，适合作为开发默认值。
 */
@Injectable()
export class TxtLoader implements ILoader {
  readonly name = 'txt';

  async load(source: string): Promise<Document[]> {
    // 同步读取整个文件（小文件场景，大文件应改用流式读取）
    const content = fs.readFileSync(source, 'utf-8');
    return [new Document({ pageContent: content, metadata: { source } })];
  }
}
