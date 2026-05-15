import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export function logRoute(pluginDataDir, entry) {
  try {
    const statsDir = path.join(pluginDataDir, 'stats');
    mkdirSync(statsDir, { recursive: true });
    appendFileSync(path.join(statsDir, 'routing-log.jsonl'), `${JSON.stringify(entry)}\n`);
  } catch {
    return;
  }
}
