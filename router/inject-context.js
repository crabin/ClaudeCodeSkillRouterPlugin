export function buildAdditionalContext(skill, skillBody) {
  const taskTags = Array.isArray(skill.task_tags) ? skill.task_tags.join(', ') : '';
  const triggerHints = Array.isArray(skill.triggers) ? skill.triggers.slice(0, 3).join('、') : '';

  if (skill.source_type === 'user-global' && skillBody) {
    return `当前任务被识别为 coding/${taskTags}。优先参考 ${skill.name} 的指导：\n${skillBody}`;
  }

  return `当前任务被识别为 coding/${taskTags}。优先参考 ${skill.name}：${skill.description}${triggerHints ? `。相关触发词：${triggerHints}` : ''}`;
}
