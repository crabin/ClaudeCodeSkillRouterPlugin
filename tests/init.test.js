import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function writeSkill(rootDir, relativeDir, content) {
  const skillDir = path.join(rootDir, relativeDir);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(path.join(skillDir, 'SKILL.md'), content);
}

test('init creates plugin data and index-only registry files from discovered skills', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-init-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const dataDir = path.join(sandboxDir, 'plugin-data');

  mkdirSync(path.join(homeDir, '.claude', 'skills'), { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  writeSkill(
    homeDir,
    '.claude/skills/systematic-debugging',
    `---
name: systematic-debugging
description: Diagnose and resolve programming errors.
domain_tags:
  - coding
task_tags:
  - debugging
triggers:
  - 排查 bug
  - 报错
anti_triggers:
  - 解释概念
---
`
  );

  writeSkill(
    projectDir,
    '.claude/skills/write-plans',
    `---
name: write-plans
description: Turn requests into concrete execution plans.
domain_tags:
  - coding
task_tags:
  - planning
triggers:
  - 计划
  - 方案
---
`
  );

  const result = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/router/init.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(path.join(dataDir, '.initialized')), true);

  const skills = JSON.parse(readFileSync(path.join(dataDir, 'registry', 'skills.json'), 'utf8'));
  const tagsIndex = JSON.parse(readFileSync(path.join(dataDir, 'registry', 'tags-index.json'), 'utf8'));
  const hashIndex = JSON.parse(readFileSync(path.join(dataDir, 'registry', 'hash-index.json'), 'utf8'));
  const routerConfig = JSON.parse(readFileSync(path.join(dataDir, 'config', 'router-config.json'), 'utf8'));
  const stats = JSON.parse(readFileSync(path.join(dataDir, 'stats', 'stats.json'), 'utf8'));
  const tags = JSON.parse(readFileSync(path.join(dataDir, 'taxonomy', 'tags.json'), 'utf8'));
  const workflows = JSON.parse(readFileSync(path.join(dataDir, 'workflows', 'workflows.json'), 'utf8'));

  assert.equal(skills.skills.length, 2);
  assert.deepEqual(tagsIndex.task_tags.debugging, ['systematic-debugging']);
  assert.deepEqual(tagsIndex.task_tags.planning, ['write-plans']);
  assert.equal(typeof hashIndex[skills.skills[0].skill_path], 'string');
  assert.equal(routerConfig.mode, 'compatibility');
  assert.equal(stats.total_routes, 0);
  assert.deepEqual(tags.domains.coding, ['debugging', 'planning']);
  assert.equal(workflows.workflows.length > 0, true);
  assert.equal(workflows.workflows[0].id, 'research-to-plan');
  assert.match(result.stdout, /initialized/i);
});
