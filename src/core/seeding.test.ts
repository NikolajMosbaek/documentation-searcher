import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chosenQuestions, formatSeedPlan, parseSeedPlan, type Area } from './seeding.js';

const AREAS: Area[] = [
  {
    title: 'What happens when a trial ends',
    why: 'Every customer passes through it, so it is asked constantly.',
    questions: ['what happens when a free trial expires?', 'am I charged automatically?'],
    chosen: false,
  },
  {
    title: 'Cancelling partway through a period',
    why: 'The refund question comes up in every support conversation.',
    questions: ['do I get a refund if I cancel?'],
    chosen: true,
  },
];

test('a plan survives being written out and read back', () => {
  const parsed = parseSeedPlan(formatSeedPlan(AREAS));

  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed.map((a) => a.title), AREAS.map((a) => a.title));
  assert.deepEqual(parsed.map((a) => a.why), AREAS.map((a) => a.why));
  assert.deepEqual(parsed.map((a) => a.questions), AREAS.map((a) => a.questions));
  assert.deepEqual(parsed.map((a) => a.chosen), [false, true]);
});

test('a proposal arrives with nothing chosen, so choosing is deliberate', () => {
  const plan = formatSeedPlan(AREAS.map((area) => ({ ...area, chosen: false })));
  assert.equal(parseSeedPlan(plan).every((area) => !area.chosen), true);
  assert.deepEqual(chosenQuestions(parseSeedPlan(plan)), []);
});

test('only ticked areas are acted on', () => {
  assert.deepEqual(chosenQuestions(AREAS), ['do I get a refund if I cancel?']);
});

test('a hand-edited plan is read forgivingly', () => {
  const edited = `# Seeding plan

Some notes the developer added.

##[X] Shouty tick, no space
Why:   spacing is all over the place
*  a question with a star bullet
   - an indented question

## [ ] Left unticked
- this one is ignored
`;
  const parsed = parseSeedPlan(edited);

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.chosen, true);
  assert.equal(parsed[0]?.title, 'Shouty tick, no space');
  assert.equal(parsed[0]?.why, 'spacing is all over the place');
  assert.deepEqual(parsed[0]?.questions, ['a question with a star bullet', 'an indented question']);
  assert.deepEqual(chosenQuestions(parsed), [
    'a question with a star bullet',
    'an indented question',
  ]);
});

test('prose before the first area is not mistaken for content', () => {
  assert.deepEqual(parseSeedPlan('# Seeding plan\n\nWhy: this line is preamble\n- so is this\n'), []);
});
