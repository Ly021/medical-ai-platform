import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { KnowledgeService } from './knowledge.service';

@Module({
  controllers: [AgentController],
  providers: [AgentService, KnowledgeService],
})
export class AgentModule {}
