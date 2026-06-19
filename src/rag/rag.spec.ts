import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Document } from '@langchain/core/documents';

import { TxtLoader } from './loaders/txt.loader';
import { MarkdownLoader } from './loaders/markdown.loader';
import { RecursiveTextSplitter } from './splitters/recursive-text-splitter';
import { SimilarityRetriever } from './retrievers/similarity.retriever';
import { HybridRetriever } from './retrievers/hybrid.retriever';
import { IngestionPipeline } from './pipeline/ingestion.pipeline';
import { QueryPipeline } from './pipeline/query.pipeline';
import { PipelineService } from './pipeline/pipeline.service';
import {
  LOADER_TOKEN,
  SPLITTER_TOKEN,
  EMBEDDER_TOKEN,
  VECTOR_STORE_TOKEN,
  RETRIEVER_TOKEN,
  GENERATOR_TOKEN,
} from './rag.constants';

// ============================================================
// 全局 Mock 实例
// ============================================================
// 所有外部依赖都用 jest.fn() 模拟，测试只验证"有没有调对方法、参数对不对"。
// 不调真实 API，不需要网络和 API Key。

const mockEmbedder = {
  name: 'mock',
  dimensions: 4,
  embedDocuments: jest.fn(),
  embedQuery: jest.fn(),
};

const mockVectorStore = {
  name: 'mock',
  addDocuments: jest.fn(),
  addVectors: jest.fn(),
  similaritySearch: jest.fn(),
  similaritySearchVector: jest.fn(),
  delete: jest.fn(),
  ensureCollection: jest.fn(),
};

const mockGenerator = {
  name: 'mock',
  generate: jest.fn(),
  generateStream: jest.fn(),
};

/** 模拟 ConfigService：根据 key 返回预定义的值 */
const mockConfig = {
  get: jest.fn((key: string, def: any) => {
    const vals: Record<string, any> = {
      RAG_CHUNK_SIZE: 500,
      RAG_CHUNK_OVERLAP: 50,
      RAG_RETRIEVAL_K: 4,
      RAG_HYBRID_ALPHA: 0.7,
      EMBEDDING_MODEL: 'embedding-2',
      ZHIPU_API_KEY: 'test-key',
      EMBEDDING_BASE_URL: 'https://test.api',
      EMBEDDING_DIMENSIONS: 1024,
    };
    return vals[key] ?? def;
  }),
};

// ============================================================
// Loader Tests —— 只测 name 属性，load 方法涉及文件 IO
// ============================================================
describe('TxtLoader', () => {
  it('should have name txt', () => {
    const loader = new TxtLoader();
    expect(loader.name).toBe('txt');
  });
});

describe('MarkdownLoader', () => {
  it('should have name markdown', () => {
    const loader = new MarkdownLoader();
    expect(loader.name).toBe('markdown');
  });
});

// ============================================================
// Splitter Tests —— 验证切分逻辑
// ============================================================
describe('RecursiveTextSplitter', () => {
  let splitter: RecursiveTextSplitter;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        RecursiveTextSplitter,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    splitter = mod.get(RecursiveTextSplitter);
  });

  it('should split a long document into chunks', async () => {
    // 1200 个字符的文档，chunkSize=500 → 至少切出 3 段
    const longText = 'A'.repeat(1200);
    const doc = new Document({ pageContent: longText, metadata: {} });
    const chunks = await splitter.splitDocuments([doc]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].pageContent.length).toBeLessThanOrEqual(500);
  });

  it('should have name recursive', () => {
    expect(splitter.name).toBe('recursive');
  });
});

// ============================================================
// Retriever Tests —— 验证调用委托和参数传递
// ============================================================
describe('SimilarityRetriever', () => {
  let retriever: SimilarityRetriever;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SimilarityRetriever,
        { provide: VECTOR_STORE_TOKEN, useValue: mockVectorStore },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    retriever = mod.get(SimilarityRetriever);
  });

  it('should delegate to vectorStore.similaritySearch', async () => {
    const docs = [new Document({ pageContent: 'result', metadata: {} })];
    mockVectorStore.similaritySearch.mockResolvedValue(docs);

    const results = await retriever.retrieve('test query', 3);

    expect(mockVectorStore.similaritySearch).toHaveBeenCalledWith('test query', 3, undefined);
    expect(results).toHaveLength(1);
  });

  it('should use default k from config when not provided', async () => {
    mockVectorStore.similaritySearch.mockResolvedValue([]);
    await retriever.retrieve('query');
    // 没传 k 时应该用配置中的 RAG_RETRIEVAL_K = 4
    expect(mockVectorStore.similaritySearch).toHaveBeenCalledWith('query', 4, undefined);
  });

  it('should have name similarity', () => {
    expect(retriever.name).toBe('similarity');
  });
});

describe('HybridRetriever', () => {
  let retriever: HybridRetriever;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        HybridRetriever,
        { provide: VECTOR_STORE_TOKEN, useValue: mockVectorStore },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    retriever = mod.get(HybridRetriever);
    jest.clearAllMocks();
  });

  it('should fetch 2*k documents from vector store for fusion', async () => {
    const docs = [
      new Document({ pageContent: 'relevant content here', metadata: { _score: 0.9 } }),
      new Document({ pageContent: 'some other text', metadata: { _score: 0.5 } }),
    ];
    mockVectorStore.similaritySearch.mockResolvedValue(docs);

    const results = await retriever.retrieve('relevant content', 2);
    // 混合检索先拉 2*k = 4 条候选
    expect(mockVectorStore.similaritySearch).toHaveBeenCalledWith('relevant content', 4, undefined);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('should have name hybrid', () => {
    expect(retriever.name).toBe('hybrid');
  });
});

// ============================================================
// IngestionPipeline Tests —— 验证 Load → Split → Embed → Store 全流程
// ============================================================
describe('IngestionPipeline', () => {
  let pipeline: IngestionPipeline;
  const mockLoader = { name: 'mock', load: jest.fn() };
  const mockSplitter = { name: 'mock', splitDocuments: jest.fn() };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        IngestionPipeline,
        { provide: LOADER_TOKEN, useValue: mockLoader },
        { provide: SPLITTER_TOKEN, useValue: mockSplitter },
        { provide: EMBEDDER_TOKEN, useValue: mockEmbedder },
        { provide: VECTOR_STORE_TOKEN, useValue: mockVectorStore },
      ],
    }).compile();
    pipeline = mod.get(IngestionPipeline);
    jest.clearAllMocks();
  });

  it('should execute full Load → Split → Embed → Store pipeline', async () => {
    const rawDoc = new Document({ pageContent: 'raw', metadata: {} });
    const chunks = [
      new Document({ pageContent: 'chunk1', metadata: {} }),
      new Document({ pageContent: 'chunk2', metadata: {} }),
    ];

    mockLoader.load.mockResolvedValue([rawDoc]);
    mockSplitter.splitDocuments.mockResolvedValue(chunks);
    mockEmbedder.embedDocuments.mockResolvedValue([[1,0,0,0], [0,1,0,0]]);

    const result = await pipeline.ingest('test.txt');

    // 验证每个步骤都被正确调用，参数传递无误
    expect(result.sourceDocuments).toBe(1);
    expect(result.chunks).toBe(2);
    expect(result.ids).toHaveLength(2);
    expect(mockLoader.load).toHaveBeenCalledWith('test.txt');
    expect(mockSplitter.splitDocuments).toHaveBeenCalledWith([rawDoc]);
    expect(mockEmbedder.embedDocuments).toHaveBeenCalledWith(['chunk1', 'chunk2']);
    expect(mockVectorStore.addVectors).toHaveBeenCalledWith(
      [[1,0,0,0], [0,1,0,0]],
      chunks,
      { ids: result.ids },
    );
  });

  it('preview should load and split without storing', async () => {
    jest.clearAllMocks(); // 清除上一个测试的 mock 记录
    const rawDoc = new Document({ pageContent: 'raw', metadata: {} });
    const chunks = [new Document({ pageContent: 'chunk', metadata: {} })];

    mockLoader.load.mockResolvedValue([rawDoc]);
    mockSplitter.splitDocuments.mockResolvedValue(chunks);

    const result = await pipeline.preview('test.txt');
    expect(result).toHaveLength(1);
    // preview 不应调 addVectors（不存库）
    expect(mockVectorStore.addVectors).not.toHaveBeenCalled();
  });
});

// ============================================================
// QueryPipeline Tests —— 验证检索 + 生成流程
// ============================================================
describe('QueryPipeline', () => {
  let pipeline: QueryPipeline;
  const mockRetriever = { name: 'mock', retrieve: jest.fn() };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        QueryPipeline,
        { provide: RETRIEVER_TOKEN, useValue: mockRetriever },
        { provide: GENERATOR_TOKEN, useValue: mockGenerator },
      ],
    }).compile();
    pipeline = mod.get(QueryPipeline);
    jest.clearAllMocks();
  });

  it('query should retrieve context then generate answer', async () => {
    const docs = [new Document({ pageContent: 'context', metadata: {} })];
    mockRetriever.retrieve.mockResolvedValue(docs);
    mockGenerator.generate.mockResolvedValue('答案');

    const result = await pipeline.query('问题');

    // 验证：先检索，再把检索结果传给生成器
    expect(mockRetriever.retrieve).toHaveBeenCalledWith('问题');
    expect(mockGenerator.generate).toHaveBeenCalledWith('问题', docs);
    expect(result.answer).toBe('答案');
    expect(result.sources).toEqual(docs);
  });

  it('search should delegate to retriever', async () => {
    const docs = [new Document({ pageContent: 'doc', metadata: {} })];
    mockRetriever.retrieve.mockResolvedValue(docs);

    const results = await pipeline.search('query', 5);
    expect(mockRetriever.retrieve).toHaveBeenCalledWith('query', 5);
    expect(results).toHaveLength(1);
  });

  it('queryStream should yield status then generator stream', async () => {
    const docs = [new Document({ pageContent: 'ctx', metadata: {} })];
    mockRetriever.retrieve.mockResolvedValue(docs);

    // 模拟生成器的流式输出
    async function* mockGenStream() {
      yield { type: 'chunk' as const, content: '答' };
      yield { type: 'done' as const };
    }
    mockGenerator.generateStream.mockReturnValue(mockGenStream());

    const chunks: any[] = [];
    for await (const c of pipeline.queryStream('question')) {
      chunks.push(c);
    }

    // 验证流式输出的顺序：状态 → 状态 → chunk → done
    expect(chunks[0]).toEqual({ type: 'status', content: '正在检索相关文档...' });
    expect(chunks[1]).toEqual({ type: 'status', content: '找到 1 个相关文档，正在生成回答...' });
    expect(chunks[2]).toEqual({ type: 'chunk', content: '答' });
    expect(chunks[3]).toEqual({ type: 'done' });
  });
});
