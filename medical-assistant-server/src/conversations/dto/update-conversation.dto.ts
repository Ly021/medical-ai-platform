import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MessageDto {
  @IsOptional()
  id?: number;

  @IsOptional()
  @IsString()
  role?: 'user' | 'assistant';

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateConversationDto {
  @ApiPropertyOptional({ description: '对话标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '消息列表', type: [MessageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages?: MessageDto[];
}
