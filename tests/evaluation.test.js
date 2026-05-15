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

test('rebuild-index refreshes registry outputs after skill changes', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-eval-rebuild-'));
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
  - 报错
---
先复现问题。
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
  - 方案
---
`
  );

  const rebuildResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/rebuild-index.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(rebuildResult.status, 0, rebuildResult.stderr);

  const skills = JSON.parse(readFileSync(path.join(dataDir, 'registry', 'skills.json'), 'utf8'));
  const tagsIndex = JSON.parse(readFileSync(path.join(dataDir, 'registry', 'tags-index.json'), 'utf8'));
  const hashIndex = JSON.parse(readFileSync(path.join(dataDir, 'registry', 'hash-index.json'), 'utf8'));

  assert.equal(skills.skills.length, 2);
  assert.deepEqual(tagsIndex.task_tags.planning, ['write-plans']);
  assert.equal(typeof hashIndex[skills.skills[0].skill_path], 'string');
  assert.match(rebuildResult.stdout, /rebuilt: 2/i);
});

test('validate-registry reports an init-generated registry as valid', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-eval-validate-'));
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
  - 报错
---
先复现问题。
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

  const validateResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/validate-registry.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(validateResult.status, 0, validateResult.stderr);
  assert.match(validateResult.stdout, /valid: true/i);
  assert.match(validateResult.stdout, /skills: 1/i);
  assert.match(validateResult.stdout, /issues: 0/i);
});

test('validate-registry reports tampered tag references as invalid', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-eval-validate-bad-'));
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
  - 报错
---
先复现问题。
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

  const tagsIndexPath = path.join(dataDir, 'registry', 'tags-index.json');
  const tagsIndex = JSON.parse(readFileSync(tagsIndexPath, 'utf8'));
  tagsIndex.task_tags.debugging = ['missing-skill'];
  writeFileSync(tagsIndexPath, `${JSON.stringify(tagsIndex, null, 2)}\n`);

  const validateResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/validate-registry.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(validateResult.status, 0, validateResult.stderr);
  assert.match(validateResult.stdout, /valid: false/i);
  assert.match(validateResult.stdout, /skills: 1/i);
  assert.match(validateResult.stdout, /issues: 2/i);
});

test('validate-registry reports duplicate skill ids and hash drift as invalid', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-eval-validate-dup-'));
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
  - 报错
---
先复现问题。
`
  );

  writeSkill(
    projectDir,
    '.claude/skills/another-debugger',
    `---
name: another-debugger
description: Another debugger.
domain_tags:
  - coding
task_tags:
  - debugging
triggers:
  - 崩溃
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

  const skillsPath = path.join(dataDir, 'registry', 'skills.json');
  const hashIndexPath = path.join(dataDir, 'registry', 'hash-index.json');
  const skillsPayload = JSON.parse(readFileSync(skillsPath, 'utf8'));
  const hashIndex = JSON.parse(readFileSync(hashIndexPath, 'utf8'));

  skillsPayload.skills[1].id = skillsPayload.skills[0].id;
  delete hashIndex[skillsPayload.skills[0].skill_path];
  hashIndex['/tmp/extra-skill/SKILL.md'] = 'sha256-extra';

  writeFileSync(skillsPath, `${JSON.stringify(skillsPayload, null, 2)}\n`);
  writeFileSync(hashIndexPath, `${JSON.stringify(hashIndex, null, 2)}\n`);

  const validateResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/validate-registry.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(validateResult.status, 0, validateResult.stderr);
  assert.match(validateResult.stdout, /valid: false/i);
  assert.match(validateResult.stdout, /skills: 2/i);
  assert.match(validateResult.stdout, /issues: [3-9]/i);
});

test('validate-registry reports duplicate tag ids and registry drift as invalid', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-eval-validate-drift-'));
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
  - 报错
---
先复现问题。
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

  const tagsIndexPath = path.join(dataDir, 'registry', 'tags-index.json');
  const tagsIndex = JSON.parse(readFileSync(tagsIndexPath, 'utf8'));
  tagsIndex.task_tags.debugging = ['systematic-debugging', 'systematic-debugging'];
  tagsIndex.task_tags.planning = [];
  writeFileSync(tagsIndexPath, `${JSON.stringify(tagsIndex, null, 2)}\n`);

  const validateResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/validate-registry.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(validateResult.status, 0, validateResult.stderr);
  assert.match(validateResult.stdout, /valid: false/i);
  assert.match(validateResult.stdout, /skills: 2/i);
  assert.match(validateResult.stdout, /issues: [2-9]/i);
});

test('summarize-routing-log aggregates skill, workflow, and confidence counts', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-eval-summary-'));
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
  - 报错
---
先复现问题。
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

  const prompts = ['帮我排查这个报错', '先调研再给出方案', '这个功能现在报错了'];
  for (const prompt of prompts) {
    const routeResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/router/route.js'], {
      cwd: projectDir,
      env: {
        ...process.env,
        HOME: homeDir,
        CLAUDE_PLUGIN_DATA: dataDir,
        CLAUDE_USER_PROMPT: prompt,
      },
      encoding: 'utf8',
    });

    assert.equal(routeResult.status, 0, routeResult.stderr);
  }

  const logPath = path.join(dataDir, 'stats', 'routing-log.jsonl');
  const existingLog = readFileSync(logPath, 'utf8');
  writeFileSync(
    logPath,
    `${existingLog}${JSON.stringify({
      prompt: '技能和工作流字段同时存在的异常记录',
      domain_tags: ['coding'],
      task_tags: ['planning'],
      selected_workflow: 'research-to-plan',
      selected_skill: 'write-plans',
      confidence: 'medium',
    })}\n${JSON.stringify({
      prompt: '随便聊聊今天吃什么',
      domain_tags: [],
      task_tags: [],
      selected_workflow: null,
      selected_skill: null,
      confidence: null,
    })}\n`
  );

  const summaryResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/summarize-routing-log.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      HOME: homeDir,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(summaryResult.status, 0, summaryResult.stderr);

  const stats = JSON.parse(readFileSync(path.join(dataDir, 'stats', 'stats.json'), 'utf8'));
  assert.equal(stats.total_routes, 5);
  assert.equal(stats.skill_routes, 3);
  assert.equal(stats.workflow_routes, 2);
  assert.equal(stats.null_routes, 1);
  assert.deepEqual(stats.confidence_counts, { high: 2, medium: 1, low: 0, none: 2 });
  assert.deepEqual(stats.routes_by_skill, { 'systematic-debugging': 2, 'write-plans': 1 });
  assert.deepEqual(stats.routes_by_workflow, { 'research-to-plan': 2 });
  assert.deepEqual(stats.domain_tag_counts, { coding: 4 });
  assert.deepEqual(stats.task_tag_counts, { debugging: 2, planning: 2 });
  assert.deepEqual(stats.confidence_by_route_type, {
    skill: { high: 2, medium: 0, low: 0, none: 0 },
    workflow: { high: 0, medium: 1, low: 0, none: 1 },
    none: { high: 0, medium: 0, low: 0, none: 1 },
  });
  assert.match(summaryResult.stdout, /routes: 5/i);
});

test('summarize-routing-log fails soft on malformed logs', () => {
  const sandboxDir = mkdtempSync(path.join(os.tmpdir(), 'skill-router-eval-summary-bad-'));
  const projectDir = path.join(sandboxDir, 'project');
  const dataDir = path.join(sandboxDir, 'plugin-data');

  mkdirSync(projectDir, { recursive: true });
  mkdirSync(path.join(dataDir, 'stats'), { recursive: true });
  writeFileSync(path.join(dataDir, 'stats', 'routing-log.jsonl'), '{bad json}\n');
  writeFileSync(path.join(dataDir, 'stats', 'stats.json'), `${JSON.stringify({ total_routes: 99 }, null, 2)}\n`);

  const summaryResult = spawnSync('node', ['/Users/lpb/workspace/myProjects/plugin/ClaudeCodeSkillRouterPlugin/scripts/summarize-routing-log.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: 'utf8',
  });

  assert.equal(summaryResult.status, 0, summaryResult.stderr);

  const stats = JSON.parse(readFileSync(path.join(dataDir, 'stats', 'stats.json'), 'utf8'));
  assert.equal(stats.total_routes, 0);
  assert.equal(stats.skill_routes, 0);
  assert.equal(stats.workflow_routes, 0);
  assert.deepEqual(stats.confidence_counts, { high: 0, medium: 0, low: 0, none: 0 });
  assert.match(summaryResult.stdout, /routes: 0/i);
});
