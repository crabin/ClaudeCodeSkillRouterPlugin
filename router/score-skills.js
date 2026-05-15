export function scoreSkill(skill, prompt) {
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

export function selectSkill(skills, prompt) {
  const ranked = skills
    .map((skill) => ({ skill, score: scoreSkill(skill, prompt) }))
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0 || ranked[0].score <= 0) {
    return null;
  }

  return ranked[0].skill;
}
