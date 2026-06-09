import { Controller, Post, Body } from '@nestjs/common';
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
}
