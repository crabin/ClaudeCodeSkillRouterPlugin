import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPrompt } from '../router/classify-tags.js';

test('classifyPrompt marks debugging prompts as coding/debugging', () => {
  const result = classifyPrompt('帮我排查这个报错');

  assert.deepEqual(result.domain_tags, ['coding']);
  assert.deepEqual(result.task_tags, ['debugging']);
});

test('classifyPrompt marks planning prompts as coding/planning', () => {
  const result = classifyPrompt('给我一个实施计划');

  assert.deepEqual(result.domain_tags, ['coding']);
  assert.deepEqual(result.task_tags, ['planning']);
});
