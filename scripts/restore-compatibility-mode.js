import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { restoreSkillFile } from '../router/skill-frontmatter.js';

function findSkillFiles(rootDir) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const skillFiles = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.shift();
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === 'SKILL.md') {
        skillFiles.push(fullPath);
      }
    }
  }

  return skillFiles.sort();
}

const skillRoots = [
  path.join(os.homedir(), '.claude', 'skills'),
  path.join(process.cwd(), '.claude', 'skills'),
];

const counts = {
  changed: 0,
  unchanged: 0,
  skipped: 0,
};

for (const skillPath of skillRoots.flatMap((rootDir) => findSkillFiles(rootDir))) {
  counts[restoreSkillFile(skillPath)] += 1;
}

process.stdout.write(`changed: ${counts.changed}, unchanged: ${counts.unchanged}, skipped: ${counts.skipped}\n`);
