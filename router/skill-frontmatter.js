import { readFileSync, writeFileSync } from 'node:fs';

function splitSkillFile(content) {
  if (!content.startsWith('---\n')) {
    return null;
  }

  const endIndex = content.indexOf('\n---', 4);
  if (endIndex === -1) {
    return null;
  }

  return {
    frontmatterLines: content.slice(4, endIndex).split('\n'),
    body: content.slice(endIndex + 4),
  };
}

function hasManagedModeFlag(frontmatterLines) {
  return frontmatterLines.some((line) => /^disable-model-invocation:\s*true\s*$/.test(line.trim()));
}

export function migrateSkillFile(skillPath) {
  const content = readFileSync(skillPath, 'utf8');
  const parts = splitSkillFile(content);

  if (!parts) {
    return 'skipped';
  }

  if (hasManagedModeFlag(parts.frontmatterLines)) {
    return 'unchanged';
  }

  const nextContent = `---\n${[...parts.frontmatterLines, 'disable-model-invocation: true'].join('\n')}\n---${parts.body}`;
  writeFileSync(skillPath, nextContent);
  return 'changed';
}

export function restoreSkillFile(skillPath) {
  const content = readFileSync(skillPath, 'utf8');
  const parts = splitSkillFile(content);

  if (!parts) {
    return 'skipped';
  }

  if (!hasManagedModeFlag(parts.frontmatterLines)) {
    return 'unchanged';
  }

  const nextFrontmatterLines = parts.frontmatterLines.filter(
    (line) => !/^disable-model-invocation:\s*true\s*$/.test(line.trim())
  );
  const nextContent = `---\n${nextFrontmatterLines.join('\n')}\n---${parts.body}`;
  writeFileSync(skillPath, nextContent);
  return 'changed';
}
