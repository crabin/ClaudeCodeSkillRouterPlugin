import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSkill } from '../router/score-skills.js';

test('selectSkill lets classified debugging intent outrank an incidental planning trigger', () => {
  const skills = [
    {
      id: 'write-plans',
      name: 'write-plans',
      triggers: ['方案'],
      anti_triggers: [],
      domain_tags: ['coding'],
      task_tags: ['planning'],
    },
    {
      id: 'systematic-debugging',
      name: 'systematic-debugging',
      triggers: [],
      anti_triggers: [],
      domain_tags: ['coding'],
      task_tags: ['debugging'],
    },
  ];

  const selectedMatch = selectSkill(skills, '这个报错的处理方案是什么', {
    domain_tags: ['coding'],
    task_tags: ['debugging'],
  });

  assert.equal(selectedMatch.skill.name, 'systematic-debugging');
  assert.notEqual(selectedMatch.confidence, 'low');
});

test('selectSkill uses anti-triggers to avoid a misleading direct hit', () => {
  const skills = [
    {
      id: 'concept-explainer',
      name: 'concept-explainer',
      triggers: ['解释'],
      anti_triggers: ['报错'],
      domain_tags: ['coding'],
      task_tags: ['explaining'],
    },
    {
      id: 'systematic-debugging',
      name: 'systematic-debugging',
      triggers: ['报错'],
      anti_triggers: [],
      domain_tags: ['coding'],
      task_tags: ['debugging'],
    },
  ];

  const selectedMatch = selectSkill(skills, '解释这个报错为什么会出现', {
    domain_tags: ['coding'],
    task_tags: ['debugging'],
  });

  assert.equal(selectedMatch.skill.name, 'systematic-debugging');
});

test('selectSkill prefers a direct trigger hit over generic classified intent', () => {
  const skills = [
    {
      id: 'generic-debugging',
      name: 'generic-debugging',
      triggers: [],
      anti_triggers: [],
      domain_tags: ['coding'],
      task_tags: ['debugging'],
    },
    {
      id: 'stacktrace-debugging',
      name: 'stacktrace-debugging',
      triggers: ['堆栈'],
      anti_triggers: [],
      domain_tags: ['coding'],
      task_tags: ['debugging'],
    },
  ];

  const selectedMatch = selectSkill(skills, '帮我看下这个堆栈报错', {
    domain_tags: ['coding'],
    task_tags: ['debugging'],
  });

  assert.equal(selectedMatch.skill.name, 'stacktrace-debugging');
});
