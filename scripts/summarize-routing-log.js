import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function emptyConfidenceCounts() {
  return {
    high: 0,
    medium: 0,
    low: 0,
    none: 0,
  };
}

const CONFIDENCE_KEYS = {
  high: true,
  medium: true,
  low: true,
  none: true,
};

function emptyStats() {
  return {
    total_routes: 0,
    skill_routes: 0,
    workflow_routes: 0,
    null_routes: 0,
    confidence_counts: emptyConfidenceCounts(),
    routes_by_skill: {},
    routes_by_workflow: {},
    domain_tag_counts: {},
    task_tag_counts: {},
    confidence_by_route_type: {
      skill: emptyConfidenceCounts(),
      workflow: emptyConfidenceCounts(),
      none: emptyConfidenceCounts(),
    },
  };
}

function incrementCounter(bucket, key) {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function normalizeConfidence(value) {
  return Object.hasOwn(CONFIDENCE_KEYS, value) ? value : 'none';
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
      const routeType = entry.selected_workflow ? 'workflow' : entry.selected_skill ? 'skill' : 'none';
      const confidence = normalizeConfidence(entry.confidence ?? 'none');
      const domainTags = Array.isArray(entry.domain_tags) ? entry.domain_tags : [];
      const taskTags = Array.isArray(entry.task_tags) ? entry.task_tags : [];

      stats.total_routes += 1;

      if (entry.selected_workflow) {
        stats.workflow_routes += 1;
        incrementCounter(stats.routes_by_workflow, entry.selected_workflow);
      }

      if (entry.selected_skill) {
        stats.skill_routes += 1;
        incrementCounter(stats.routes_by_skill, entry.selected_skill);
      }

      if (!entry.selected_skill && !entry.selected_workflow) {
        stats.null_routes += 1;
      }

      stats.confidence_counts[confidence] += 1;
      stats.confidence_by_route_type[routeType][confidence] += 1;

      for (const tag of domainTags) {
        incrementCounter(stats.domain_tag_counts, tag);
      }

      for (const tag of taskTags) {
        incrementCounter(stats.task_tag_counts, tag);
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
