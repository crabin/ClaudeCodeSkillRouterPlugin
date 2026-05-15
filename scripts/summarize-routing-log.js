import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function emptyStats() {
  return {
    total_routes: 0,
    skill_routes: 0,
    workflow_routes: 0,
    confidence_counts: {
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    },
  };
}

function summarizeRoutingLog(pluginDataDir) {
  const logPath = path.join(pluginDataDir, 'stats', 'routing-log.jsonl');

  if (!existsSync(logPath)) {
    return emptyStats();
  }

  try {
    const lines = readFileSync(logPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const stats = emptyStats();

    for (const line of lines) {
      const entry = JSON.parse(line);
      stats.total_routes += 1;

      if (entry.selected_workflow) {
        stats.workflow_routes += 1;
      }

      if (entry.selected_skill) {
        stats.skill_routes += 1;
      }

      const confidence = entry.confidence ?? 'none';
      if (Object.hasOwn(stats.confidence_counts, confidence)) {
        stats.confidence_counts[confidence] += 1;
      } else {
        stats.confidence_counts.none += 1;
      }
    }

    return stats;
  } catch {
    return emptyStats();
  }
}

const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA;

if (!pluginDataDir) {
  throw new Error('CLAUDE_PLUGIN_DATA is required');
}

const statsDir = path.join(pluginDataDir, 'stats');
mkdirSync(statsDir, { recursive: true });
const stats = summarizeRoutingLog(pluginDataDir);
writeFileSync(path.join(statsDir, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`);
process.stdout.write(`routes: ${stats.total_routes}, skill_routes: ${stats.skill_routes}, workflow_routes: ${stats.workflow_routes}\n`);
