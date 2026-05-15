import { readFileSync } from 'node:fs';
import path from 'node:path';

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function validateRegistry(pluginDataDir) {
  const registryDir = path.join(pluginDataDir, 'registry');
  const issues = [];

  try {
    const skillsPayload = readJson(path.join(registryDir, 'skills.json'));
    const tagsIndex = readJson(path.join(registryDir, 'tags-index.json'));
    const hashIndex = readJson(path.join(registryDir, 'hash-index.json'));
    const skills = Array.isArray(skillsPayload.skills) ? skillsPayload.skills : [];
    const skillIds = new Set(skills.map((skill) => skill.id));

    for (const skill of skills) {
      if (!skill.id) {
        issues.push('missing skill id');
        continue;
      }

      if (typeof hashIndex[skill.skill_path] !== 'string' || !hashIndex[skill.skill_path].startsWith('sha256-')) {
        issues.push(`invalid hash for ${skill.id}`);
      }
    }

    for (const key of ['domain_tags', 'task_tags']) {
      const buckets = tagsIndex[key] ?? {};

      for (const ids of Object.values(buckets)) {
        if (!Array.isArray(ids)) {
          issues.push(`invalid ${key} bucket`);
          continue;
        }

        const sortedIds = [...ids].sort();
        if (JSON.stringify(ids) !== JSON.stringify(sortedIds)) {
          issues.push(`unsorted ${key} bucket`);
        }

        for (const skillId of ids) {
          if (!skillIds.has(skillId)) {
            issues.push(`unknown skill id ${skillId} in ${key}`);
          }
        }
      }
    }

    return {
      valid: issues.length === 0,
      skills: skills.length,
      issues,
    };
  } catch (error) {
    return {
      valid: false,
      skills: 0,
      issues: [error instanceof Error ? error.message : String(error)],
    };
  }
}

const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA;

if (!pluginDataDir) {
  throw new Error('CLAUDE_PLUGIN_DATA is required');
}

const result = validateRegistry(pluginDataDir);
process.stdout.write(`valid: ${result.valid}, skills: ${result.skills}, issues: ${result.issues.length}\n`);
