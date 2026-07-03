import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { KnowledgeService } from './knowledge.service';
import { PromptService } from './prompt.service';

@Module({
  controllers: [AgentController],
  providers: [AgentService, KnowledgeService, PromptService],
})
export class AgentModule {}
