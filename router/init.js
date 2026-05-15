import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildRegistry, writeRegistryFiles } from './build-registry.js';

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function initPluginData(pluginDataDir, projectRoot) {
  const registryDir = path.join(pluginDataDir, 'registry');
  const configDir = path.join(pluginDataDir, 'config');
  const statsDir = path.join(pluginDataDir, 'stats');
  const taxonomyDir = path.join(pluginDataDir, 'taxonomy');
  const workflowsDir = path.join(pluginDataDir, 'workflows');

  ensureDir(registryDir);
  ensureDir(configDir);
  ensureDir(statsDir);
  ensureDir(taxonomyDir);
  ensureDir(workflowsDir);

  const registry = buildRegistry(projectRoot);

  writeRegistryFiles(pluginDataDir, registry);
  writeFileSync(
    path.join(configDir, 'router-config.json'),
    `${JSON.stringify({ mode: 'compatibility' }, null, 2)}\n`
  );
  writeFileSync(
    path.join(statsDir, 'stats.json'),
    `${JSON.stringify({ total_routes: 0 }, null, 2)}\n`
  );
  writeFileSync(
    path.join(taxonomyDir, 'tags.json'),
    `${JSON.stringify({ domains: { coding: ['debugging', 'planning'] } }, null, 2)}\n`
  );
  writeFileSync(
    path.join(workflowsDir, 'workflows.json'),
    `${JSON.stringify({
      workflows: [
        {
          id: 'research-to-plan',
          description: 'Research a technical topic and turn findings into an execution plan.',
          domain_tags: ['coding'],
          task_tags: ['planning'],
          triggers: ['先调研再给出方案', '调研并给出方案'],
          steps: ['systematic-debugging', 'write-plans'],
        },
      ],
    }, null, 2)}\n`
  );
  writeFileSync(path.join(pluginDataDir, '.initialized'), 'true\n');
}

const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA;

if (!pluginDataDir) {
  throw new Error('CLAUDE_PLUGIN_DATA is required');
}

initPluginData(pluginDataDir, process.cwd());
process.stdout.write('initialized\n');
