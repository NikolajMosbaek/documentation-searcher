import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksDependent, noFollowUpResolver } from './followUp.js';

test('questions that hand their subject back to the conversation are caught', () => {
  for (const question of [
    'and if they have no card?',
    'what about existing customers?',
    'does it retry?',
    'why?',
    'how many times?',
    'and what happens then?',
    'is that the same for annual plans?',
    'ok, and them?',
  ]) {
    assert.equal(looksDependent(question), true, question);
  }
});

test('questions that stand on their own are left alone', () => {
  for (const question of [
    'What happens when a customer redeems a voucher at checkout?',
    'How long does the dunning sequence run before access is suspended?',
    'When is a subscriber emailed about an upcoming renewal charge?',
  ]) {
    assert.equal(looksDependent(question), false, question);
  }
});

test('an empty question is not treated as a follow-up', () => {
  assert.equal(looksDependent(''), false);
  assert.equal(looksDependent('   '), false);
});

test('the do-nothing resolver returns the question untouched', async () => {
  const question = 'and what about them?';
  assert.equal(
    await noFollowUpResolver.resolve(question, { threadId: 't', turns: [] }),
    question,
  );
});

test('asking for more of the previous answer counts as leaning on it', () => {
  // These cleared every rule when measured: they open with a verb and name
  // enough nouns to look self-contained, while meaning nothing on their own.
  for (const question of [
    'could you expand on the third step?',
    'say more about the edge cases',
    'tell me more',
    'go on',
    'what about the second one',
    'explain more',
  ]) {
    assert.equal(looksDependent(question), true, question);
  }
});

/**
 * Measured against thirteen standalone questions written by a model rather than
 * by hand, as this bot's own seeding proposed them. Nine of the thirteen are
 * flagged as dependent, because a question about a bot naturally says "it".
 *
 * That is left alone deliberately. A false positive costs one rewrite that
 * returns the question unchanged -- a few seconds and a few cents -- while a
 * false negative costs a derivation of a question nobody can read, at about a
 * dollar, plus a knowledge-base entry to match. At those relative prices the
 * bias is worth roughly twenty false positives per false negative avoided.
 */
test('a standalone question mentioning "it" is flagged, and that is the cheap mistake', () => {
  assert.equal(looksDependent('will it ever give me file names or code in an answer?'), true);
  // Nothing containing no referent and standing on its own should be flagged.
  assert.equal(looksDependent('what does an answer from the bot actually look like?'), false);
  assert.equal(looksDependent('how much of the earlier conversation does the bot remember?'), false);
});
