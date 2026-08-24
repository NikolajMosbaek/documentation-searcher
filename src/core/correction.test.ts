import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asGuidance, looksLikeCorrection } from './correction.js';

test('someone disputing the last answer is recognised', () => {
  for (const message of [
    "that's wrong",
    "That's not right, we stopped doing that",
    'this is wrong',
    'no, that is not how it works',
    'that is out of date',
    "the retry count isn't correct",
    'that doesn\'t match what I see',
    'no longer true since the rewrite',
  ]) {
    assert.equal(looksLikeCorrection(message), true, message);
  }
});

test('an ordinary question is not mistaken for a dispute', () => {
  for (const message of [
    'What happens when a free trial expires?',
    'and how does it know?',
    'is that the same for annual plans?',
    'what happens if the payment is wrong?',
    'how do I correct an entry?',
  ]) {
    assert.equal(looksLikeCorrection(message), false, message);
  }
});

test('an objection is passed on as something to check, never as fact', () => {
  const guidance = asGuidance('  that is wrong, we retry six times  ');

  assert.match(guidance, /that is wrong, we retry six times/);
  assert.match(guidance, /not evidence/);
  assert.match(guidance, /Read the code again/);
  // The engine must be told it is allowed to disagree with the person.
  assert.match(guidance, /say so plainly rather than changing/);
});
