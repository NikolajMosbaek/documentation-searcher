import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatAnswer,
  missAnswer,
  recentlyRecheckedAnswer,
  recheckFailedAnswer,
  type Answer,
} from './answer.js';

const BODY = {
  shortAnswer: 'A trial converts automatically unless it is cancelled first.',
  behaviour: ['The customer is emailed three days before'],
  edgeCases: ['No saved card: access simply stops'],
};

/** Every provenance an answer can carry, so none can be added unrendered. */
const EVERY_SOURCE: Array<Answer['source']> = [
  'knowledge-base',
  'engine',
  'corrected',
  'rechecked',
  'stale',
  'miss',
];

test('every provenance renders the answer itself', () => {
  for (const source of EVERY_SOURCE) {
    const rendered = formatAnswer({ ...BODY, source });
    assert.match(rendered, /A trial converts automatically/, source);
    assert.match(rendered, /\*\*Short answer\*\*/, source);
  }
});

test('only a genuinely stale answer is described as out of date', () => {
  for (const source of EVERY_SOURCE) {
    const rendered = formatAnswer({ ...BODY, source });
    const warns = /out of date/.test(rendered);
    assert.equal(warns, source === 'stale', `${source} warned=${warns}`);
  }
});

test('an answer re-read moments ago does not claim the code has changed', () => {
  const rendered = formatAnswer(recentlyRecheckedAnswer());

  assert.match(rendered, /very recently/);
  // The bug this test exists for: borrowing the stale provenance attached a
  // notice saying the opposite of what the message says.
  assert.doesNotMatch(rendered, /out of date/);
  assert.doesNotMatch(rendered, /could not be checked/);
});

test('a failed re-read says so and claims nothing else', () => {
  const rendered = formatAnswer(recheckFailedAnswer());
  assert.match(rendered, /could not read the code again/);
  assert.doesNotMatch(rendered, /out of date/);
});

test('a miss offers no answer and no warning', () => {
  const rendered = formatAnswer(missAnswer());
  assert.match(rendered, /don't have an answer/);
  assert.doesNotMatch(rendered, /out of date/);
});
