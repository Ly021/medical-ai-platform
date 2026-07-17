import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ChatDto {
  @ApiProperty({ description: '用户消息内容（字符串或多模态数组）' })
  message: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

  @ApiPropertyOptional({ description: '对话线程ID（用于LangGraph状态恢复）' })
  @IsOptional()
  @IsString()
  threadId?: string;
}
