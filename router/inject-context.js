export function buildAdditionalContext(skill, skillBody, confidence) {
  const taskTags = Array.isArray(skill.task_tags) ? skill.task_tags.join(', ') : '';
  const triggerHints = Array.isArray(skill.triggers) ? skill.triggers.slice(0, 3).join('、') : '';
  const scope = `当前任务被识别为 coding/${taskTags}`;

  if (confidence === 'low') {
    return '';
  }

  if (confidence === 'high') {
    if (skill.source_type === 'user-global' && skillBody) {
      return `${scope}。高置信度命中 ${skill.name}，优先参考它的指导：\n${skillBody}`;
    }

    return `${scope}。高置信度命中 ${skill.name}：${skill.description}${triggerHints ? `。相关触发词：${triggerHints}` : ''}`;
  }

  return `${scope}。中置信度命中 ${skill.name}：${skill.description}${triggerHints ? `。相关触发词：${triggerHints}` : ''}`;
}
