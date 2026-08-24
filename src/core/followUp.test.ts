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
