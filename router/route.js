import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAdditionalContext } from './inject-context.js';

function readRegistry(pluginDataDir) {
  const registryPath = path.join(pluginDataDir, 'registry', 'skills.json');

  try {
    return JSON.parse(readFileSync(registryPath, 'utf8')).skills;
  } catch {
    return [];
  }
}

function readTrustedSkillBody(skill) {
  if (skill.source_type !== 'user-global') {
    return '';
  }

  const content = readFileSync(skill.skill_path, 'utf8');
  if (!content.startsWith('---\n')) {
    return content.trim();
  }

  const endIndex = content.indexOf('\n---', 4);
  if (endIndex === -1) {
    return content.trim();
  }

  return content.slice(endIndex + 4).trim();
}

function scoreSkill(skill, prompt) {
  const promptText = prompt.toLowerCase();
  const triggers = Array.isArray(skill.triggers) ? skill.triggers : [];
  const taskTags = Array.isArray(skill.task_tags) ? skill.task_tags : [];
  const domainTags = Array.isArray(skill.domain_tags) ? skill.domain_tags : [];
  const antiTriggers = Array.isArray(skill.anti_triggers) ? skill.anti_triggers : [];

  const triggerScore = triggers.reduce(
    (total, trigger) => total + (promptText.includes(String(trigger).toLowerCase()) ? 3 : 0),
    0
  );
  const taskTagScore = taskTags.reduce(
    (total, tag) => total + (promptText.includes(String(tag).toLowerCase()) ? 2 : 0),
    0
  );
  const domainTagScore = domainTags.reduce(
    (total, tag) => total + (promptText.includes(String(tag).toLowerCase()) ? 1 : 0),
    0
  );
  const antiTriggerPenalty = antiTriggers.reduce(
    (total, trigger) => total + (promptText.includes(String(trigger).toLowerCase()) ? 4 : 0),
    0
  );

  return triggerScore + taskTagScore + domainTagScore - antiTriggerPenalty;
}

function selectSkill(skills, prompt) {
  const ranked = skills
    .map((skill) => ({ skill, score: scoreSkill(skill, prompt) }))
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0 || ranked[0].score <= 0) {
    return null;
  }

  return ranked[0].skill;
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
const selectedSkill = selectSkill(skills, prompt);
const skillBody = selectedSkill ? readTrustedSkillBody(selectedSkill) : '';
const additionalContext = selectedSkill ? buildAdditionalContext(selectedSkill, skillBody) : '';

process.stdout.write(
  `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  })}\n`
);
