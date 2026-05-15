import { readFileSync } from 'node:fs';
import path from 'node:path';

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function addExpectedTag(expectedBuckets, key, tag, skillId) {
  if (!expectedBuckets[key][tag]) {
    expectedBuckets[key][tag] = [];
  }

  expectedBuckets[key][tag].push(skillId);
}

function validateBucket(key, tag, ids, expectedIds, knownSkillIds, issues) {
  if (!Array.isArray(ids)) {
    issues.push(`invalid ${key} bucket`);
    return;
  }

  const sortedIds = [...ids].sort();
  if (JSON.stringify(ids) !== JSON.stringify(sortedIds)) {
    issues.push(`unsorted ${key} bucket ${tag}`);
  }

  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    issues.push(`duplicate skill ids in ${key} bucket ${tag}`);
  }

  for (const skillId of ids) {
    if (!knownSkillIds.has(skillId)) {
      issues.push(`unknown skill id ${skillId} in ${key}`);
    }
  }

  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    issues.push(`drifted ${key} bucket ${tag}`);
  }
}

function validateRegistry(pluginDataDir) {
  const registryDir = path.join(pluginDataDir, 'registry');
  const issues = [];

  try {
    const skillsPayload = readJson(path.join(registryDir, 'skills.json'));
    const tagsIndex = readJson(path.join(registryDir, 'tags-index.json'));
    const hashIndex = readJson(path.join(registryDir, 'hash-index.json'));
    const skills = Array.isArray(skillsPayload.skills) ? skillsPayload.skills : [];
    const skillIds = new Set();
    const skillPaths = new Set();
    const expectedBuckets = {
      domain_tags: {},
      task_tags: {},
    };

    for (const skill of skills) {
      if (!skill.id) {
        issues.push('missing skill id');
        continue;
      }

      if (skillIds.has(skill.id)) {
        issues.push(`duplicate skill id ${skill.id}`);
      }
      skillIds.add(skill.id);

      if (!skill.skill_path) {
        issues.push(`missing skill path for ${skill.id}`);
      } else {
        skillPaths.add(skill.skill_path);
      }

      if (typeof hashIndex[skill.skill_path] !== 'string' || !hashIndex[skill.skill_path].startsWith('sha256-')) {
        issues.push(`invalid hash for ${skill.id}`);
      }

      for (const key of ['domain_tags', 'task_tags']) {
        const tags = Array.isArray(skill[key]) ? skill[key] : [];
        for (const tag of tags) {
          addExpectedTag(expectedBuckets, key, tag, skill.id);
        }
      }
    }

    for (const hashPath of Object.keys(hashIndex)) {
      if (!skillPaths.has(hashPath)) {
        issues.push(`extra hash entry ${hashPath}`);
      }
    }

    for (const key of ['domain_tags', 'task_tags']) {
      const buckets = tagsIndex[key] ?? {};
      const expected = expectedBuckets[key];

      for (const [tag, expectedIds] of Object.entries(expected)) {
        expected[tag] = [...expectedIds].sort();
      }

      for (const [tag, ids] of Object.entries(buckets)) {
        validateBucket(key, tag, ids, expected[tag] ?? [], skillIds, issues);
      }

      for (const tag of Object.keys(expected)) {
        if (!Object.hasOwn(buckets, tag)) {
          issues.push(`missing ${key} bucket ${tag}`);
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
