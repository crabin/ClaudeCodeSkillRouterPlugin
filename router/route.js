import { readFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyPrompt } from './classify-tags.js';
import { buildAdditionalContext } from './inject-context.js';
import { logRoute } from './log-route.js';
import { resolveWorkflow } from './resolve-workflow.js';
import { selectSkill } from './score-skills.js';

function readRegistry(pluginDataDir) {
  const registryPath = path.join(pluginDataDir, 'registry', 'skills.json');

  try {
    return JSON.parse(readFileSync(registryPath, 'utf8')).skills;
  } catch {
    return [];
  }
}

function isTrustedGlobalSkill(skill) {
  if (skill.source_type !== 'user-global') {
    return false;
  }

  try {
    const trustedRoot = realpathSync(path.join(os.homedir(), '.claude', 'skills'));
    const resolvedSkillPath = realpathSync(skill.skill_path);
    const relativePath = path.relative(trustedRoot, resolvedSkillPath);

    return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  } catch {
    return false;
  }
}

function readTrustedSkillBody(skill) {
  if (!isTrustedGlobalSkill(skill)) {
    return '';
  }

  try {
    const content = readFileSync(skill.skill_path, 'utf8');
    if (!content.startsWith('---\n')) {
      return content.trim();
    }

    const endIndex = content.indexOf('\n---', 4);
    if (endIndex === -1) {
      return content.trim();
    }

    return content.slice(endIndex + 4).trim();
  } catch {
    return '';
  }
}

const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA;
const prompt = process.env.CLAUDE_USER_PROMPT;

if (!pluginDataDir) {
  throw new Error('CLAUDE_PLUGIN_DATA is required');
}

if (!prompt) {
  throw new Error('CLAUDE_USER_PROMPT is required');
}

const skills = readRegistry(pluginDataDir);
const classification = classifyPrompt(prompt);
const selectedWorkflow = resolveWorkflow(pluginDataDir, prompt, classification);
const selectedMatch = selectedWorkflow ? null : selectSkill(skills, prompt, classification);
const selectedSkill = selectedMatch ? selectedMatch.skill : null;
const skillBody =
  selectedMatch?.confidence === 'high' && selectedSkill
    ? readTrustedSkillBody(selectedSkill)
    : '';
const selection = selectedWorkflow
  ? { type: 'workflow', workflow: selectedWorkflow }
  : selectedMatch
    ? { type: 'skill', skill: selectedSkill, confidence: selectedMatch.confidence }
    : null;
const additionalContext = buildAdditionalContext(selection, skillBody);

logRoute(pluginDataDir, {
  prompt,
  domain_tags: classification.domain_tags,
  task_tags: classification.task_tags,
  selected_workflow: selectedWorkflow ? selectedWorkflow.id : null,
  selected_skill: selectedSkill ? selectedSkill.name : null,
  confidence: selectedMatch ? selectedMatch.confidence : null,
});

process.stdout.write(
  `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  })}\n`
);
