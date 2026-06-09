import { Injectable, OnModuleInit } from '@nestjs/common';
import { createAgent, initChatModel, tool } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import * as z from 'zod';
import { KnowledgeService } from './knowledge.service';

@Injectable()
export class AgentService implements OnModuleInit {
  private agent: Awaited<ReturnType<typeof createAgent>>;

  constructor(private readonly knowledge: KnowledgeService) {}

  async onModuleInit() {
    const model = await initChatModel('openai:glm-4.7-flash', {
      temperature: 0.5,
      maxTokens: 4096,
      apiKey: process.env.ZHIPU_API_KEY,
      configuration: {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
      },
    });

    const getWeather = tool(
      async (input) => {
        const res = await fetch(
          `https://wttr.in/${encodeURIComponent(input.city)}?format=j1`,
        );
        const data = await res.json();
        const c = data.current_condition[0];
        return `${input.city}天气：${c.weatherDesc[0].value}，温度${c.temp_C}°C，体感${c.FeelsLikeC}°C，湿度${c.humidity}%，风速${c.windspeedKmph}km/h`;
      },
      {
        name: 'get_weather',
        description: 'Get real-time weather for a city',
        schema: z.object({
          city: z.string().describe('City name in English, e.g. Beijing'),
        }),
      },
    );

    const getTime = tool(
      () => new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      {
        name: 'get_time',
        description: 'Get the current time in Asia/Shanghai timezone',
        schema: z.object({}),
      },
    );

    const searchKnowledge = tool(
      async (input) => this.knowledge.search(input.query),
      {
        name: 'search_knowledge',
        description: 'Search local knowledge base for information about NestJS, LangChain, Agent, RAG, etc.',
        schema: z.object({
          query: z.string().describe('Search query'),
        }),
      },
    );

    this.agent = createAgent({
      model,
      tools: [getWeather, getTime, searchKnowledge],
      systemPrompt: 'Reply in Chinese. CRITICAL: Always call search_knowledge first before answering any knowledge-related question. Do NOT rely on your own memory.',
      checkpointer: new MemorySaver(),
    });
  }

  async chat(content: string, threadId = 'default'): Promise<string> {
    const result = await this.agent.invoke(
      { messages: [{ role: 'user', content }] },
      { configurable: { thread_id: threadId } },
    );

    const lastMsg = result.messages.at(-1);
    return typeof lastMsg?.content === 'string'
      ? lastMsg.content
      : JSON.stringify(lastMsg?.content);
  }
}
