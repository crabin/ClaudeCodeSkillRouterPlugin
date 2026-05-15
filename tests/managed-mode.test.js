import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function writeSkill(rootDir, relativeDir, content) {
  const skillDir = path.join(rootDir, relativeDir);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(path.join(skillDir, 'SKILL.md'), content);
}

test('migrate-managed-mode adds disable-model-invocation to a clean skill file', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-managed-mode-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const skillPath = path.join(homeDir, '.claude', 'skills', 'systematic-debugging', 'SKILL.md');

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
---
先复现问题。
再缩小错误范围。
`
  );

  const result = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/migrate-managed-mode.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);

  const migrated = readFileSync(skillPath, 'utf8');
  assert.match(migrated, /disable-model-invocation: true/);
  assert.match(migrated, /name: systematic-debugging/);
  assert.match(migrated, /先复现问题。/);
  assert.match(result.stdout, /changed: 1/i);
});

test('restore-compatibility-mode removes disable-model-invocation and keeps the rest intact', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-restore-mode-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const skillPath = path.join(homeDir, '.claude', 'skills', 'systematic-debugging', 'SKILL.md');

  mkdirSync(path.join(homeDir, '.claude', 'skills'), { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  writeSkill(
    homeDir,
    '.claude/skills/systematic-debugging',
    `---
name: systematic-debugging
description: Diagnose and resolve programming errors.
disable-model-invocation: true
domain_tags:
  - coding
task_tags:
  - debugging
---
先复现问题。
再缩小错误范围。
`
  );

  const result = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/restore-compatibility-mode.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);

  const restored = readFileSync(skillPath, 'utf8');
  assert.doesNotMatch(restored, /disable-model-invocation: true/);
  assert.match(restored, /name: systematic-debugging/);
  assert.match(restored, /先复现问题。/);
  assert.match(result.stdout, /changed: 1/i);
});

test('migrate-managed-mode is idempotent for already managed skills', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-managed-idempotent-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const skillPath = path.join(homeDir, '.claude', 'skills', 'systematic-debugging', 'SKILL.md');

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
---
先复现问题。
再缩小错误范围。
`
  );

  const firstResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/migrate-managed-mode.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
    },
    encoding: 'utf8',
  });
  const secondResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/migrate-managed-mode.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
    },
    encoding: 'utf8',
  });

  assert.equal(firstResult.status, 0, firstResult.stderr);
  assert.equal(secondResult.status, 0, secondResult.stderr);

  const migrated = readFileSync(skillPath, 'utf8');
  const occurrences = migrated.match(/disable-model-invocation: true/g) ?? [];

  assert.equal(occurrences.length, 1);
  assert.match(secondResult.stdout, /unchanged: 1/i);
});

test('migrate-managed-mode skips files without valid frontmatter', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-managed-skip-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const skillPath = path.join(homeDir, '.claude', 'skills', 'broken-skill', 'SKILL.md');

  mkdirSync(path.join(homeDir, '.claude', 'skills'), { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  writeSkill(
    homeDir,
    '.claude/skills/broken-skill',
    `name: broken-skill
description: Missing frontmatter fence.
正文不应被改写。
`
  );

  const result = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/migrate-managed-mode.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);

  const unchanged = readFileSync(skillPath, 'utf8');
  assert.doesNotMatch(unchanged, /disable-model-invocation: true/);
  assert.match(unchanged, /正文不应被改写。/);
  assert.match(result.stdout, /skipped: 1/i);
});

test('migrate-managed-mode scans both global and project skill directories', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-managed-sources-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const globalSkillPath = path.join(homeDir, '.claude', 'skills', 'global-skill', 'SKILL.md');
  const localSkillPath = path.join(projectDir, '.claude', 'skills', 'local-skill', 'SKILL.md');

  mkdirSync(path.join(homeDir, '.claude', 'skills'), { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  writeSkill(
    homeDir,
    '.claude/skills/global-skill',
    `---
name: global-skill
description: Global skill.
---
全局技能。
`
  );
  writeSkill(
    projectDir,
    '.claude/skills/local-skill',
    `---
name: local-skill
description: Local skill.
---
项目技能。
`
  );

  const result = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/migrate-managed-mode.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(globalSkillPath, 'utf8'), /disable-model-invocation: true/);
  assert.match(readFileSync(localSkillPath, 'utf8'), /disable-model-invocation: true/);
  assert.match(result.stdout, /changed: 2/i);
});

test('migrated skills remain scannable by init', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-managed-init-'));
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
---
先复现问题。
再缩小错误范围。
`
  );

  const migrateResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/migrate-managed-mode.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
    },
    encoding: 'utf8',
  });
  const initResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/router/init.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(migrateResult.status, 0, migrateResult.stderr);
  assert.equal(initResult.status, 0, initResult.stderr);

  const skills = JSON.parse(readFileSync(path.join(dataDir, 'registry', 'skills.json'), 'utf8'));
  assert.equal(skills.skills.length, 1);
  assert.equal(skills.skills[0].name, 'systematic-debugging');
});
