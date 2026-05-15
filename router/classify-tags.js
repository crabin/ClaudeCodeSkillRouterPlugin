export function classifyPrompt(prompt) {
  const promptText = prompt.toLowerCase();

  if (promptText.includes('计划') || promptText.includes('方案')) {
    return {
      domain_tags: ['coding'],
      task_tags: ['planning'],
    };
  }

  if (promptText.includes('报错') || promptText.includes('bug') || promptText.includes('debug')) {
    return {
      domain_tags: ['coding'],
      task_tags: ['debugging'],
    };
  }

  return {
    domain_tags: ['coding'],
    task_tags: [],
  };
}
