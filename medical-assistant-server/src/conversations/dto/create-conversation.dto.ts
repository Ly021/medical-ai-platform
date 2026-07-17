import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional({ description: '对话标题', example: '感冒咨询' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: '对话线程ID（用于LangGraph状态恢复）' })
  @IsString()
  threadId: string;
}
