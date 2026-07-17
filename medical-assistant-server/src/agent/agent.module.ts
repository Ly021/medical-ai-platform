import { Module } from '@nestjs/common';
import { RagModule } from '../rag/rag.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { PromptService } from './prompt.service';

@Module({
  imports: [RagModule.register()],
  controllers: [AgentController],
  providers: [AgentService, PromptService],
})
export class AgentModule {}
