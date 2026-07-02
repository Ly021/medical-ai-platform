import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PipelineService } from './pipeline/pipeline.service';

/**
 * RAG CLI 命令行工具
 *
 * 不需要启动 HTTP 服务也能用，适合脚本批量处理。
 *
 * 用法：
 *   npx ts-node src/rag/rag.cli.ts ingest ./data        # 入库
 *   npx ts-node src/rag/rag.cli.ts search "关键词" 5     # 检索
 *   npx ts-node src/rag/rag.cli.ts query "你的问题"      # 问答
 */
async function main() {
  // 创建 NestJS 应用上下文（不启动 HTTP，只初始化 DI 容器）
  const app = await NestFactory.createApplicationContext(AppModule);
  const pipeline = app.get(PipelineService);

  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'ingest': {
      const source = args[0] || './data';
      console.log(`Ingesting: ${source}`);
      const result = await pipeline.ingest(source);
      console.log(`Done: ${result.chunks} chunks from ${result.sourceDocuments} documents`);
      console.log(`IDs: ${result.ids.slice(0, 5).join(', ')}...`);
      break;
    }
    case 'search': {
      const query = args[0];
      if (!query) {
        console.log('Usage: npx ts-node src/rag/rag.cli.ts search <query> [k]');
        break;
      }
      const k = parseInt(args[1] || '5', 10);
      console.log(`Searching: "${query}" (k=${k})`);
      const docs = await pipeline.search(query, k);
      docs.forEach((doc, i) => {
        console.log(`\n[${i + 1}] Score: ${(doc.metadata._score as number)?.toFixed(4)}`);
        console.log(`    Source: ${doc.metadata.source}`);
        console.log(`    ${doc.pageContent.substring(0, 200)}...`);
      });
      break;
    }
    case 'query': {
      const question = args.join(' ');
      if (!question) {
        console.log('Usage: npx ts-node src/rag/rag.cli.ts query <question>');
        break;
      }
      console.log(`Question: ${question}`);
      const result = await pipeline.query(question);
      console.log(`\nAnswer: ${result.answer}`);
      console.log(`\nSources: ${result.sources.length} documents`);
      break;
    }
    default:
      console.log('Usage: npx ts-node src/rag/rag.cli.ts <ingest|search|query> [args]');
  }

  await app.close();
}

main().catch(console.error);
