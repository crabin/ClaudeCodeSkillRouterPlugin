import { buildRegistry, writeRegistryFiles } from '../router/build-registry.js';

const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA;

if (!pluginDataDir) {
  throw new Error('CLAUDE_PLUGIN_DATA is required');
}

const registry = buildRegistry(process.cwd());
writeRegistryFiles(pluginDataDir, registry);
process.stdout.write(`rebuilt: ${registry.skills.skills.length}\n`);
