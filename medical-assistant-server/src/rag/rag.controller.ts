import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync, unlinkSync, existsSync } from 'fs';
import { PipelineService } from './pipeline/pipeline.service';
import { IngestDto } from './dto/ingest.dto';
import { SearchDto } from './dto/search.dto';
import { QueryDto } from './dto/query.dto';
import { PreviewDto } from './dto/preview.dto';

// @types/multer 未安装，自行声明文件类型
interface UploadedFileType {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  path: string;
}

/**
 * RAG HTTP 控制器
 *
 * 对外暴露 5 个 REST 端点，所有路由前缀为 /rag：
 *
 *   POST /rag/ingest        — 文档入库（传文件路径）
 *   POST /rag/ingest/upload — 文档入库（上传文件）
 *   POST /rag/search        — 纯检索（返回文档原文片段）
 *   POST /rag/query        — RAG 问答（非流式）
 *   POST /rag/query/stream — RAG 问答（SSE 流式，逐字推送）
 */
@Controller('rag')
export class RagController {
  constructor(private readonly pipeline: PipelineService) {}

  /** 文档入库：接收文件路径，执行 Load → Split → Embed → Store */
  @Post('ingest')
  async ingest(@Body() dto: IngestDto) {
    const result = await this.pipeline.ingest(dto.source);
    return { success: true, ...result };
  }

  /** 文件上传入库：接收上传的文件，保存到临时目录后入库，处理完自动清理 */
  @Post('ingest/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, name);
        },
      }),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '文档文件 (.txt/.md/.pdf)' },
      },
    },
  })
  async ingestUpload(@UploadedFile() file: UploadedFileType) {
    const allowed = ['.txt', '.md', '.pdf'];

    if (!file) {
      throw new HttpException(
        `请上传文件（字段名: file），仅支持 ${allowed.join(', ')} 格式`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const ext = extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      // 删除已保存的无效文件
      if (file.path && existsSync(file.path)) {
        unlinkSync(file.path);
      }
      throw new HttpException(
        `不支持的文件类型 "${ext}"，仅支持 ${allowed.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.pipeline.ingest(file.path);
      return { success: true, fileName: file.originalname, ...result };
    } finally {
      if (file?.path && existsSync(file.path)) {
        unlinkSync(file.path);
      }
    }
  }

  /** 纯检索：只搜不生成，返回文档片段 */
  @Post('search')
  async search(@Body() dto: SearchDto) {
    const docs = await this.pipeline.search(dto.query, dto.k);
    return {
      query: dto.query,
      results: docs.map((d) => ({
        content: d.pageContent.substring(0, 500), // 截断过长内容，前端展示友好
        score: d.metadata._score,
        source: d.metadata.source,
      })),
    };
  }

  /** 非流式问答：一次请求，完整返回 */
  @Post('query')
  async query(@Body() dto: QueryDto) {
    const result = await this.pipeline.query(dto.question);
    return {
      question: dto.question,
      answer: result.answer,
      sources: result.sources.map((d) => ({
        content: d.pageContent.substring(0, 300),
        score: d.metadata._score,
      })),
    };
  }

  /**
   * 流式问答（SSE）
   *
   * 实现要点：
   * - 设置 text/event-stream 头，告诉浏览器这是 SSE 流
   * - flushHeaders() 立即发送响应头，不等 body
   * - 60 秒超时保护：防止客户端断开后服务端一直挂着
   * - 每个 chunk 按 SSE 格式写入：data: {json}\n\n
   */
  @Post('query/stream')
  async queryStream(@Body() dto: QueryDto, @Res() res: Response) {
    if (!dto?.question) {
      res.status(400).json({ error: '请提供 question 字段' });
      return;
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
    res.flushHeaders(); // 立即发送 HTTP 头

    // 60 秒超时保护
    const timeout = setTimeout(() => {
      res.write(`data: ${JSON.stringify({ type: 'error', content: '请求超时' })}\n\n`);
      res.end();
    }, 60_000);

    try {
      for await (const chunk of this.pipeline.queryStream(dto.question)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: String(err) })}\n\n`);
    } finally {
      clearTimeout(timeout);
    }

    res.end();
  }

  /** 列出所有已入库文档 */
  @Get('documents')
  async getDocuments() {
    const data = await this.pipeline.getAllDocuments();
    return { success: true, data };
  }

  /** 按 ID 数组删除文档 */
  @Delete('documents')
  async deleteDocuments(@Body() body: { ids: string[] }) {
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      throw new HttpException('请提供要删除的文档 ID 列表', HttpStatus.BAD_REQUEST);
    }
    await this.pipeline.deleteDocuments(body.ids);
    return { success: true, deleted: body.ids.length };
  }

  /** 预览服务端路径文件的分段结果（不入库） */
  @Post('preview')
  async preview(@Body() dto: PreviewDto) {
    try {
      const chunks = await this.pipeline.preview(dto.source);
      return {
        success: true,
        source: dto.source,
        chunks: chunks.length,
        preview: chunks.map((doc, i) => ({
          index: i,
          content: doc.pageContent.substring(0, 300),
          charCount: doc.pageContent.length,
        })),
      };
    } catch (err) {
      throw new HttpException(
        `预览失败: ${(err as Error).message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** 上传文件预览分段结果（不入库） */
  @Post('preview/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, name);
        },
      }),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '文档文件 (.txt/.md/.pdf)' },
      },
    },
  })
  async previewUpload(@UploadedFile() file: UploadedFileType) {
    const allowed = ['.txt', '.md', '.pdf'];
    if (!file) {
      throw new HttpException(
        `请上传文件（字段名: file），仅支持 ${allowed.join(', ')} 格式`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const ext = extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      if (file.path && existsSync(file.path)) unlinkSync(file.path);
      throw new HttpException(
        `不支持的文件类型 "${ext}"，仅支持 ${allowed.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const chunks = await this.pipeline.preview(file.path);
      return {
        success: true,
        fileName: file.originalname,
        chunks: chunks.length,
        preview: chunks.map((doc, i) => ({
          index: i,
          content: doc.pageContent.substring(0, 300),
          charCount: doc.pageContent.length,
        })),
      };
    } finally {
      if (file?.path && existsSync(file.path)) unlinkSync(file.path);
    }
  }
}
