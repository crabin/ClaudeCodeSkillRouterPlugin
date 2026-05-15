import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function writeSkill(rootDir, relativeDir, content) {
  const skillDir = path.join(rootDir, relativeDir);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(path.join(skillDir, 'SKILL.md'), content);
}

test('route returns additionalContext for the best-matching debugging skill', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-route-'));
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
  - debug
anti_triggers:
  - 解释概念
---
先复现问题。
再缩小错误范围。
最后验证根因。
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

  const initResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/router/init.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(initResult.status, 0, initResult.stderr);

  const routeResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/router/route.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
      CLAUDE_USER_PROMPT: '帮我排查这个报错',
    },
    encoding: 'utf8',
  });

  assert.equal(routeResult.status, 0, routeResult.stderr);

  const payload = JSON.parse(routeResult.stdout);
  assert.equal(payload.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(payload.hookSpecificOutput.additionalContext, /systematic-debugging/);
  assert.match(payload.hookSpecificOutput.additionalContext, /先复现问题/);
  assert.match(payload.hookSpecificOutput.additionalContext, /验证根因/);
});

test('project-local skills match by metadata but do not inject raw body content', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-route-local-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const dataDir = path.join(sandboxDir, 'plugin-data');

  mkdirSync(path.join(homeDir, '.claude', 'skills'), { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  writeSkill(
    projectDir,
    '.claude/skills/local-debug',
    `---
name: local-debug
description: Local debugging helper.
domain_tags:
  - coding
task_tags:
  - debugging
triggers:
  - 本地报错
  - 本地调试
---
项目内私有步骤。
不要把这段正文直接注入。
`
  );

  const initResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/router/init.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(initResult.status, 0, initResult.stderr);

  const routeResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/router/route.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
      CLAUDE_USER_PROMPT: '请帮我处理本地报错',
    },
    encoding: 'utf8',
  });

  assert.equal(routeResult.status, 0, routeResult.stderr);

  const payload = JSON.parse(routeResult.stdout);
  assert.equal(payload.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(payload.hookSpecificOutput.additionalContext, /local-debug/);
  assert.match(payload.hookSpecificOutput.additionalContext, /Local debugging helper/);
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /项目内私有步骤/);
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /不要把这段正文直接注入/);
});

test('route fails open with empty additionalContext when registry data is missing', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-route-empty-'));
  const projectDir = path.join(sandboxDir, 'project');
  const dataDir = path.join(sandboxDir, 'plugin-data');

  mkdirSync(projectDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });

  const routeResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/router/route.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: dataDir,
      CLAUDE_USER_PROMPT: '帮我排查这个报错',
    },
    encoding: 'utf8',
  });

  assert.equal(routeResult.status, 0, routeResult.stderr);

  const payload = JSON.parse(routeResult.stdout);
  assert.equal(payload.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.equal(payload.hookSpecificOutput.additionalContext, '');
});
