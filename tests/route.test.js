import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
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

  const logPath = path.join(dataDir, 'stats', 'routing-log.jsonl');
  const logLines = readFileSync(logPath, 'utf8').trim().split('\n');
  const lastLog = JSON.parse(logLines.at(-1));

  assert.equal(lastLog.prompt, '帮我排查这个报错');
  assert.deepEqual(lastLog.domain_tags, ['coding']);
  assert.deepEqual(lastLog.task_tags, ['debugging']);
  assert.equal(lastLog.selected_skill, 'systematic-debugging');
});

test('route only injects a summary for medium-confidence matches', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-route-medium-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const dataDir = path.join(sandboxDir, 'plugin-data');

  mkdirSync(path.join(homeDir, '.claude', 'skills'), { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  writeSkill(
    homeDir,
    '.claude/skills/quick-debug-hints',
    `---
name: quick-debug-hints
description: Fast debugging triage hints.
domain_tags:
  - coding
triggers:
  - 报错
---
先看堆栈。
再验证输入。
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
      CLAUDE_USER_PROMPT: '这个功能现在报错了',
    },
    encoding: 'utf8',
  });

  assert.equal(routeResult.status, 0, routeResult.stderr);

  const payload = JSON.parse(routeResult.stdout);
  assert.equal(payload.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(payload.hookSpecificOutput.additionalContext, /中置信度/);
  assert.match(payload.hookSpecificOutput.additionalContext, /quick-debug-hints/);
  assert.match(payload.hookSpecificOutput.additionalContext, /Fast debugging triage hints/);
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /先看堆栈/);
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /再验证输入/);
});

test('route leaves additionalContext empty for low-confidence matches', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-route-low-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const dataDir = path.join(sandboxDir, 'plugin-data');

  mkdirSync(path.join(homeDir, '.claude', 'skills'), { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  writeSkill(
    homeDir,
    '.claude/skills/generic-coding',
    `---
name: generic-coding
description: Generic coding help.
domain_tags:
  - coding
---
这段正文不应在低置信度时注入。
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
      CLAUDE_USER_PROMPT: '我想聊点别的东西',
    },
    encoding: 'utf8',
  });

  assert.equal(routeResult.status, 0, routeResult.stderr);

  const payload = JSON.parse(routeResult.stdout);
  assert.equal(payload.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.equal(payload.hookSpecificOutput.additionalContext, '');
});

test('medium-confidence matches fail open when trusted skill body becomes unreadable', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-route-medium-missing-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const dataDir = path.join(sandboxDir, 'plugin-data');
  const skillPath = path.join(homeDir, '.claude', 'skills', 'quick-debug-hints', 'SKILL.md');

  mkdirSync(path.join(homeDir, '.claude', 'skills'), { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  writeSkill(
    homeDir,
    '.claude/skills/quick-debug-hints',
    `---
name: quick-debug-hints
description: Fast debugging triage hints.
domain_tags:
  - coding
triggers:
  - 报错
---
先看堆栈。
再验证输入。
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
  unlinkSync(skillPath);

  const routeResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/router/route.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
      CLAUDE_USER_PROMPT: '这个功能现在报错了',
    },
    encoding: 'utf8',
  });

  assert.equal(routeResult.status, 0, routeResult.stderr);

  const payload = JSON.parse(routeResult.stdout);
  assert.equal(payload.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(payload.hookSpecificOutput.additionalContext, /中置信度/);
  assert.match(payload.hookSpecificOutput.additionalContext, /quick-debug-hints/);
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /先看堆栈/);
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
  assert.match(payload.hookSpecificOutput.additionalContext, /高置信度/);
  assert.match(payload.hookSpecificOutput.additionalContext, /local-debug/);
  assert.match(payload.hookSpecificOutput.additionalContext, /Local debugging helper/);
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /项目内私有步骤/);
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /不要把这段正文直接注入/);
});

test('tampered registry entries do not bypass trusted skill body injection rules', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-route-tampered-'));
  const homeDir = path.join(sandboxDir, 'home');
  const projectDir = path.join(sandboxDir, 'project');
  const dataDir = path.join(sandboxDir, 'plugin-data');
  const registryPath = path.join(dataDir, 'registry', 'skills.json');
  const localSkillPath = path.join(projectDir, '.claude', 'skills', 'local-debug', 'SKILL.md');

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

  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  registry.skills[0].source_type = 'user-global';
  registry.skills[0].skill_path = localSkillPath;
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

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
  assert.match(payload.hookSpecificOutput.additionalContext, /高置信度/);
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
