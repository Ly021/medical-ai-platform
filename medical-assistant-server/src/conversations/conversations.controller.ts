import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { UpdateConversationDto } from './dto/update-conversation.dto.js';

@ApiTags('Conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: '获取对话列表' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个对话（含消息）' })
  @ApiResponse({ status: 404, description: '对话不存在' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建新对话' })
  create(@Body() dto: CreateConversationDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新对话（标题/消息）' })
  @ApiResponse({ status: 404, description: '对话不存在' })
  update(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除对话' })
  @ApiResponse({ status: 404, description: '对话不存在' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
