import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PromptService implements OnModuleInit {
  private prompts = new Map<string, string>();

  onModuleInit() {
    // dist/agent/prompts (build) or src/agent/prompts (ts-node direct)
    const candidates = [
      path.resolve(__dirname, 'prompts'),
      path.resolve(process.cwd(), 'src/agent/prompts'),
    ];
    const dir = candidates.find((d) => fs.existsSync(d));
    if (!dir) {
      console.warn('[PromptService] prompts directory not found');
      return;
    }

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const name = path.basename(file, '.md');
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      this.prompts.set(name, content);
    }
    console.log(`[PromptService] Loaded ${this.prompts.size} prompts`);
  }

  get(name: string, vars?: Record<string, string>): string {
    const template = this.prompts.get(name);
    if (!template) throw new Error(`Prompt "${name}" not found`);

    if (!vars) return template;

    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
  }
}
