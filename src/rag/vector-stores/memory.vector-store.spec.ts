import { Test } from '@nestjs/testing';
import { Document } from '@langchain/core/documents';
import { MemoryVectorStore } from './memory.vector-store';
import { EMBEDDER_TOKEN } from '../rag.constants';

/**
 * 模拟的 Embedder，所有方法都是 jest.fn()，可以在测试中控制返回值。
 * 用 mock 而不是真实 API 的好处：不需要网络、不需要 API Key、速度快、结果可控。
 */
const mockEmbedder = {
  name: 'mock',
  dimensions: 4,
  embedDocuments: jest.fn(),
  embedQuery: jest.fn(),
};

describe('MemoryVectorStore', () => {
  let store: MemoryVectorStore;

  // 每个测试用例运行前都重建 store，保证测试之间互不影响
  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        MemoryVectorStore,
        { provide: EMBEDDER_TOKEN, useValue: mockEmbedder }, // 用 mock 替换真实 embedder
      ],
    }).compile();
    store = mod.get(MemoryVectorStore);
    jest.clearAllMocks(); // 清除上一次测试的 mock 调用记录
  });

  // ============================
  // addVectors + similaritySearch
  // ============================
  describe('addVectors + similaritySearch', () => {
    it('should add vectors and retrieve them by query', async () => {
      // 准备：2 篇文档 + 2 个向量
      const docs = [
        new Document({ pageContent: 'NestJS依赖注入', metadata: { source: 'a.txt' } }),
        new Document({ pageContent: '北京天气晴朗', metadata: { source: 'b.txt' } }),
      ];
      const vectors = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
      ];

      await store.addVectors(vectors, docs, { ids: ['id-a', 'id-b'] });

      // 模拟查询向量接近 doc-0（第一个文档）
      mockEmbedder.embedQuery.mockResolvedValue([0.9, 0.1, 0, 0]);

      const results = await store.similaritySearch('NestJS', 2);

      // 断言：返回 2 条，第一条应该是 "NestJS依赖注入"（相似度更高）
      expect(results).toHaveLength(2);
      expect(results[0].metadata.source).toBe('a.txt');
    });

    it('should respect k parameter', async () => {
      // 存入 3 篇文档
      const docs = [
        new Document({ pageContent: 'A', metadata: {} }),
        new Document({ pageContent: 'B', metadata: {} }),
        new Document({ pageContent: 'C', metadata: {} }),
      ];
      const vectors = [[1,0,0,0], [0,1,0,0], [0,0,1,0]];

      await store.addVectors(vectors, docs);

      mockEmbedder.embedQuery.mockResolvedValue([1, 0, 0, 0]);

      const results = await store.similaritySearch('A', 1);
      // k=1 应该只返回 1 条
      expect(results).toHaveLength(1);
    });
  });

  // ============================
  // addDocuments
  // ============================
  describe('addDocuments', () => {
    it('should embed and store documents', async () => {
      const doc = new Document({ pageContent: 'hello world', metadata: {} });
      // mock embedDocuments 返回假向量
      mockEmbedder.embedDocuments.mockResolvedValue([[1, 2, 3, 4]]);

      await store.addDocuments([doc]);
      // addDocuments 内部调了 embedDocuments + addVectors，不抛异常即成功
    });
  });

  // ============================
  // delete
  // ============================
  describe('delete', () => {
    it('should delete documents by id', async () => {
      const docs = [
        new Document({ pageContent: 'keep', metadata: {} }),
        new Document({ pageContent: 'drop', metadata: {} }),
      ];
      await store.addVectors([[1,0,0,0], [0,1,0,0]], docs, { ids: ['keep', 'drop'] });

      // 删除 id='drop' 的文档
      await store.delete({ ids: ['drop'] });

      // 查询接近 "drop" 文档的向量 → 应该只剩 "keep"
      mockEmbedder.embedQuery.mockResolvedValue([0, 1, 0, 0]);
      const results = await store.similaritySearch('drop', 2);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe('keep');
    });
  });

  // ============================
  // similaritySearchVector
  // ============================
  describe('similaritySearchVector', () => {
    it('should search by pre-computed embedding', async () => {
      const docs = [
        new Document({ pageContent: 'first', metadata: {} }),
        new Document({ pageContent: 'second', metadata: {} }),
      ];
      await store.addVectors([[1,0,0,0], [0,1,0,0]], docs);

      // 直接用向量搜索，不走 embedQuery
      const results = await store.similaritySearchVector([0.9, 0, 0, 0], 1);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe('first');
    });
  });
});
