import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAdditionalContext } from './inject-context.js';
import { selectSkill } from './score-skills.js';

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
