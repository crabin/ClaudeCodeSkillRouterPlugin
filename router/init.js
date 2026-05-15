import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    return {};
  }

  const endIndex = content.indexOf('\n---', 4);
  if (endIndex === -1) {
    return {};
  }

  const lines = content.slice(4, endIndex).split('\n');
  const data = {};
  let currentKey = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      continue;
    }

    const listMatch = line.match(/^\s+-\s+(.*)$/);
    if (listMatch && currentKey) {
      data[currentKey] = [...(data[currentKey] ?? []), listMatch[1].trim()];
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      currentKey = null;
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (value) {
      data[key] = value;
      currentKey = null;
      continue;
    }

    data[key] = [];
    currentKey = key;
  }

  return data;
}

function findSkillFiles(rootDir) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const skillFiles = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.shift();
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === 'SKILL.md') {
        skillFiles.push(fullPath);
      }
    }
  }

  return skillFiles.sort();
}

function toSkillRecord(skillPath, sourceType) {
  const content = readFileSync(skillPath, 'utf8');
  const frontmatter = parseFrontmatter(content);
  const id = frontmatter.name || path.basename(path.dirname(skillPath));

  return {
    id,
    name: id,
    description: frontmatter.description || '',
    source_type: sourceType,
    skill_path: skillPath,
    domain_tags: frontmatter.domain_tags ?? [],
    task_tags: frontmatter.task_tags ?? [],
    triggers: frontmatter.triggers ?? [],
    anti_triggers: frontmatter.anti_triggers ?? [],
    content_hash: `sha256-${createHash('sha256').update(content).digest('hex')}`,
  };
}

function addTagEntries(index, key, values, skillId) {
  const nextEntries = { ...index[key] };

  for (const value of values) {
    nextEntries[value] = [...(nextEntries[value] ?? []), skillId].sort();
  }

  return {
    ...index,
    [key]: nextEntries,
  };
}

function buildRegistry(projectRoot) {
  const sources = [
    {
      dir: path.join(os.homedir(), '.claude', 'skills'),
      sourceType: 'user-global',
    },
    {
      dir: path.join(projectRoot, '.claude', 'skills'),
      sourceType: 'project-local',
    },
  ];

  const skills = sources.flatMap(({ dir, sourceType }) =>
    findSkillFiles(dir).map((skillPath) => toSkillRecord(skillPath, sourceType))
  );

  let tagsIndex = {
    domain_tags: {},
    task_tags: {},
  };

  const hashIndex = {};

  for (const skill of skills) {
    tagsIndex = addTagEntries(tagsIndex, 'domain_tags', skill.domain_tags, skill.id);
    tagsIndex = addTagEntries(tagsIndex, 'task_tags', skill.task_tags, skill.id);
    hashIndex[skill.skill_path] = skill.content_hash;
  }

  return {
    skills: { skills },
    tagsIndex,
    hashIndex,
  };
}

function initPluginData(pluginDataDir, projectRoot) {
  const registryDir = path.join(pluginDataDir, 'registry');
  const configDir = path.join(pluginDataDir, 'config');
  const statsDir = path.join(pluginDataDir, 'stats');
  const taxonomyDir = path.join(pluginDataDir, 'taxonomy');

  ensureDir(registryDir);
  ensureDir(configDir);
  ensureDir(statsDir);
  ensureDir(taxonomyDir);

  const registry = buildRegistry(projectRoot);

  writeFileSync(path.join(registryDir, 'skills.json'), `${JSON.stringify(registry.skills, null, 2)}\n`);
  writeFileSync(path.join(registryDir, 'tags-index.json'), `${JSON.stringify(registry.tagsIndex, null, 2)}\n`);
  writeFileSync(path.join(registryDir, 'hash-index.json'), `${JSON.stringify(registry.hashIndex, null, 2)}\n`);
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
  writeFileSync(path.join(pluginDataDir, '.initialized'), 'true\n');
}

const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA;

if (!pluginDataDir) {
  throw new Error('CLAUDE_PLUGIN_DATA is required');
}

initPluginData(pluginDataDir, process.cwd());
process.stdout.write('initialized\n');
