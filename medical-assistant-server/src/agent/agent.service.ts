import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAgent, initChatModel, tool } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import * as z from 'zod';
import { KnowledgeService } from './knowledge.service';
import { PromptService } from './prompt.service';

@Injectable()
export class AgentService implements OnModuleInit {
  private agent: Awaited<ReturnType<typeof createAgent>>;
  private initPromise: Promise<void>;

  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly config: ConfigService,
    private readonly prompt: PromptService,
  ) {}

  onModuleInit() {
    this.initPromise = this.initAgent().catch((err) => {
      console.error('[AgentService] Agent 初始化失败:', err);
    });
  }

  private async initAgent() {
    const model = await initChatModel('openai:qwen-turbo', {
      temperature: 0.5,
      maxTokens: 4096,
      apiKey: this.config.get('DASHSCOPE_API_KEY'),
      configuration: {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
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
      systemPrompt: this.prompt.get('system'),
      checkpointer: new MemorySaver(),
    });

    console.log('[AgentService] Agent 初始化完成');
  }

  async chat(content: string, threadId = 'default'): Promise<string> {
    if (!this.agent) return 'AI 服务正在初始化中，请稍后重试。';
    const result = await this.agent.invoke(
      { messages: [{ role: 'user', content }] },
      { configurable: { thread_id: threadId } },
    );

    const lastMsg = result.messages.at(-1);
    return typeof lastMsg?.content === 'string'
      ? lastMsg.content
      : JSON.stringify(lastMsg?.content);
  }

  async *streamChat(content: string, threadId = 'default') {
    if (!this.agent) {
      yield { type: 'error', content: 'AI 服务正在初始化中，请稍后重试。' };
      return;
    }
    const stream = await this.agent.stream(
      { messages: [{ role: 'user', content }] },
      { configurable: { thread_id: threadId }, streamMode: 'messages' },
    );

    for await (const [msg] of stream) {
      if (msg?.content) {
        yield { type: 'chunk', content: msg.content };
      } else if ((msg as any)?.tool_calls?.length) {
        const names = (msg as any).tool_calls.map((t: any) => t.name).join(', ');
        yield { type: 'status', content: `正在调用工具: ${names}` };
      }
    }

    yield { type: 'done' };
  }
}
