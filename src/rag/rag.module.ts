import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LOADER_TOKEN,
  SPLITTER_TOKEN,
  EMBEDDER_TOKEN,
  VECTOR_STORE_TOKEN,
  RETRIEVER_TOKEN,
  GENERATOR_TOKEN,
} from './rag.constants';
import type { LoaderType, VectorStoreType, RetrieverType } from './rag.constants';
import type { RagModuleOptions } from './rag.config';

import type { ILoader } from './interfaces/loader.interface';
import type { ITextSplitter } from './interfaces/splitter.interface';
import type { IEmbedder } from './interfaces/embedder.interface';
import type { IVectorStore } from './interfaces/vector-store.interface';
import type { IRetriever } from './interfaces/retriever.interface';
import type { IGenerator } from './interfaces/generator.interface';

import { TxtLoader } from './loaders/txt.loader';
import { MarkdownLoader } from './loaders/markdown.loader';
import { PdfLoader } from './loaders/pdf.loader';
import { DirectoryLoader } from './loaders/directory.loader';
import { RecursiveTextSplitter } from './splitters/recursive-text-splitter';
import { OpenAICompatibleEmbedder } from './embedders/openai-compatible.embedder';
import { QdrantVectorStore } from './vector-stores/qdrant.vector-store';
import { MemoryVectorStore } from './vector-stores/memory.vector-store';
import { SimilarityRetriever } from './retrievers/similarity.retriever';
import { HybridRetriever } from './retrievers/hybrid.retriever';
import { LlmGenerator } from './generators/llm.generator';
import { IngestionPipeline } from './pipeline/ingestion.pipeline';
import { QueryPipeline } from './pipeline/query.pipeline';
import { PipelineService } from './pipeline/pipeline.service';
import { RagController } from './rag.controller';

/**
 * RAG 动态模块
 *
 * 核心设计：通过 `register(options?)` 创建可配置的模块。
 * 每个流水线阶段使用 Provider + useFactory 模式：
 *   从 ConfigService 读取环境变量 → 根据类型创建对应的实现类
 *
 * 三层配置优先级（数字越小优先级越高）：
 *   1. register(options) 代码传参
 *   2. 环境变量（.env 文件）
 *   3. 代码硬编码默认值
 *
 * 使用方式：
 *   // 全默认
 *   RagModule.register()
 *
 *   // 自定义
 *   RagModule.register({ retriever: 'hybrid', chunkSize: 800 })
 */
@Module({})
export class RagModule {
  static register(options?: RagModuleOptions): DynamicModule {
    // ---- Loader Provider ----
    const loaderProvider: Provider = {
      provide: LOADER_TOKEN,
      useFactory: (config: ConfigService) => {
        // 优先用代码传参，其次读环境变量 RAG_LOADER，最后默认 'txt'
        const type = options?.loader ?? config.get<LoaderType>('RAG_LOADER', 'txt');
        switch (type) {
          case 'txt': return new TxtLoader();
          case 'markdown': return new MarkdownLoader();
          case 'pdf': return new PdfLoader();
          case 'directory': return new DirectoryLoader(config);
          default: throw new Error(`Unknown loader type: ${type}`);
        }
      },
      inject: [ConfigService],
    };

    // ---- Splitter Provider ----
    const splitterProvider: Provider = {
      provide: SPLITTER_TOKEN,
      useFactory: (config: ConfigService) => new RecursiveTextSplitter(config),
      inject: [ConfigService],
    };

    // ---- Embedder Provider ----
    const embedderProvider: Provider = {
      provide: EMBEDDER_TOKEN,
      useFactory: (config: ConfigService) => new OpenAICompatibleEmbedder(config),
      inject: [ConfigService],
    };

    // ---- Vector Store Provider ----
    const vectorStoreProvider: Provider = {
      provide: VECTOR_STORE_TOKEN,
      // 注入 ConfigService（读配置）和 EMBEDDER_TOKEN（向量库需要 embedder 做查询向量化）
      useFactory: (config: ConfigService, embedder: IEmbedder) => {
        const type = options?.vectorStore ?? config.get<VectorStoreType>('RAG_VECTOR_STORE', 'memory');
        switch (type) {
          case 'memory': return new MemoryVectorStore(embedder);
          case 'qdrant': return new QdrantVectorStore(config, embedder);
          default: throw new Error(`Unknown vector store type: ${type}`);
        }
      },
      inject: [ConfigService, EMBEDDER_TOKEN],
    };

    // ---- Retriever Provider ----
    const retrieverProvider: Provider = {
      provide: RETRIEVER_TOKEN,
      useFactory: (config: ConfigService, store: IVectorStore) => {
        const type = options?.retriever ?? config.get<RetrieverType>('RAG_RETRIEVER', 'similarity');
        switch (type) {
          case 'similarity': return new SimilarityRetriever(store, config);
          case 'hybrid': return new HybridRetriever(store, config);
          default: throw new Error(`Unknown retriever type: ${type}`);
        }
      },
      inject: [ConfigService, VECTOR_STORE_TOKEN],
    };

    // ---- Generator Provider ----
    const generatorProvider: Provider = {
      provide: GENERATOR_TOKEN,
      useFactory: (config: ConfigService) => new LlmGenerator(config),
      inject: [ConfigService],
    };

    return {
      module: RagModule,
      providers: [
        // 6 个策略 Provider
        loaderProvider,
        splitterProvider,
        embedderProvider,
        vectorStoreProvider,
        retrieverProvider,
        generatorProvider,
        // 2 个流水线编排 + 1 个门面
        IngestionPipeline,
        QueryPipeline,
        PipelineService,
      ],
      controllers: [RagController],
      exports: [PipelineService], // 导出给其他模块（如 AgentModule）使用
    };
  }
}
