import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AgentService } from './agent.service';

class ChatDto {
  message: string;
  threadId?: string;
}

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chat(@Body() dto: ChatDto): Promise<{ reply: string }> {
    if (!dto?.message) {
      return { reply: '请提供 message 字段' };
    }
    const reply = await this.agentService.chat(dto.message, dto.threadId);
    return { reply };
  }

  @Post('chat/stream')
  async chatStream(@Body() dto: ChatDto, @Res() res: Response) {
    if (!dto?.message) {
      res.status(400).json({ error: '请提供 message 字段' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 60s 总超时
    const timeout = setTimeout(() => {
      res.write(`data: ${JSON.stringify({ type: 'error', content: '请求超时' })}\n\n`);
      res.end();
    }, 60_000);

    try {
      for await (const chunk of this.agentService.streamChat(
        dto.message,
        dto.threadId,
      )) {
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
