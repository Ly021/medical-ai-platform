import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PipelineService } from './pipeline/pipeline.service';
import { IngestDto } from './dto/ingest.dto';
import { SearchDto } from './dto/search.dto';
import { QueryDto } from './dto/query.dto';

/**
 * RAG HTTP 控制器
 *
 * 对外暴露 4 个 REST 端点，所有路由前缀为 /rag：
 *
 *   POST /rag/ingest       — 文档入库
 *   POST /rag/search       — 纯检索（返回文档原文片段）
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
}
