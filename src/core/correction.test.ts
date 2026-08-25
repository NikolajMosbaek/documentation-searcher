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

/**
 * Measured in iteration 23 against eighteen ways a person might say the last
 * answer was wrong. Ten of them fell through the original patterns, which meant
 * the correction path simply did not fire for most real phrasings.
 */
test('the ways people actually say an answer is wrong are recognised', () => {
  for (const message of [
    "that doesn't sound right to me",
    'I think you have that backwards',
    'we changed that last sprint',
    'hmm, that contradicts what the code says',
    'nope',
    'not quite',
    'the answer is stale',
    'you are mistaken about the retries',
    'incorrect',
    'that used to be true but not any more',
  ]) {
    assert.equal(looksLikeCorrection(message), true, message);
  }
});

test('questions that merely mention being wrong are not disputes', () => {
  // "does the answer contradict the docs?" was flagged when the contradiction
  // pattern was first widened, and is an ordinary question.
  for (const message of [
    'does the answer contradict the docs?',
    'why is the retry count incorrect in the invoice?',
    'who do I tell when something is out of date?',
    'how do I correct an entry?',
    'what happens if the payment is wrong?',
    'what does it say when it does not know the answer?',
  ]) {
    assert.equal(looksLikeCorrection(message), false, message);
  }
});

test('an assertion about what the code really does is a dispute; asking is not', () => {
  // Found by testing the correction path against objections of varying
  // plausibility: an objection framed as authorship went unrecognised, so the
  // entry was never re-checked and the message was answered as a new question.
  for (const message of [
    'I wrote that part of the system. It actually runs shell commands as well as reading.',
    'that actually does the opposite',
    'no, it actually reads the whole file',
  ]) {
    assert.equal(looksLikeCorrection(message), true, message);
  }

  // "actually" before an auxiliary is a question, not a correction.
  for (const message of [
    'does it actually re-check its answers on a schedule?',
    'what does it actually look like when it does not know?',
    'how does it actually decide which entry to use?',
  ]) {
    assert.equal(looksLikeCorrection(message), false, message);
  }
});
