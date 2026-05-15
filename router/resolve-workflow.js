import { readFileSync } from 'node:fs';
import path from 'node:path';

function readWorkflows(pluginDataDir) {
  const workflowsPath = path.join(pluginDataDir, 'workflows', 'workflows.json');

  try {
    return JSON.parse(readFileSync(workflowsPath, 'utf8')).workflows ?? [];
  } catch {
    return [];
  }
}

function hasExplicitMultiStepSignal(promptText, workflow) {
  const triggers = Array.isArray(workflow.triggers) ? workflow.triggers : [];

  if (triggers.some((trigger) => trigger && promptText.includes(trigger.toLowerCase()))) {
    return true;
  }

  return (
    promptText.includes('调研') &&
    (promptText.includes('方案') || promptText.includes('建议')) &&
    ((promptText.includes('先') && promptText.includes('再')) || promptText.includes('并给出'))
  );
}

function scoreWorkflow(workflow, promptText, classification) {
  if (!hasExplicitMultiStepSignal(promptText, workflow)) {
    return 0;
  }

  const domainTags = Array.isArray(workflow.domain_tags) ? workflow.domain_tags : [];
  const taskTags = Array.isArray(workflow.task_tags) ? workflow.task_tags : [];
  const classifiedDomainScore = domainTags.reduce(
    (total, tag) => total + (classification.domain_tags.includes(tag) ? 1 : 0),
    0
  );
  const classifiedTaskScore = taskTags.reduce(
    (total, tag) => total + (classification.task_tags.includes(tag) ? 1 : 0),
    0
  );

  return 4 + classifiedDomainScore + classifiedTaskScore;
}

export function resolveWorkflow(pluginDataDir, prompt, classification) {
  const promptText = prompt.toLowerCase();
  const workflows = readWorkflows(pluginDataDir);
  const ranked = workflows
    .map((workflow) => ({ workflow, score: scoreWorkflow(workflow, promptText, classification) }))
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0 || ranked[0].score <= 0) {
    return null;
  }

  return ranked[0].workflow;
}
