import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { UpdateConversationDto } from './dto/update-conversation.dto.js';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly repo: Repository<Conversation>,
  ) {}

  findAll(): Promise<Conversation[]> {
    return this.repo.find({
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Conversation> {
    const conv = await this.repo.findOne({ where: { id } });
    if (!conv) throw new NotFoundException('对话不存在');
    return conv;
  }

  create(dto: CreateConversationDto): Promise<Conversation> {
    return this.repo.save(this.repo.create({ ...dto, messages: '[]' }));
  }

  async update(id: string, dto: UpdateConversationDto): Promise<Conversation> {
    const conv = await this.findOne(id);
    if (dto.title !== undefined) conv.title = dto.title;
    if (dto.messages !== undefined) conv.messages = JSON.stringify(dto.messages);
    return this.repo.save(conv);
  }

  async remove(id: string): Promise<void> {
    const conv = await this.findOne(id);
    await this.repo.remove(conv);
  }
}
