import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRetrievalIndex, tokenize } from './retrieval.js';
import { parseEntry, type Entry } from './knowledgeBase.js';

function entry(file: string, frontmatter: string, body: string): Entry {
  return parseEntry(file, `---\n${frontmatter}\n---\n\n${body}`);
}

const TRIAL = entry(
  'trial-expiry.md',
  'title: When a free trial ends\nkeywords: trial, trials, free trial, expiry, expires, trial ends, converts',
  '## Short answer\nA trial converts to a paid subscription automatically unless the customer cancels before it ends.\n\n## What happens\n1. The customer is emailed three days before the trial ends\n2. On the final day the saved payment method is charged\n\n## Edge cases\n- No saved payment method: access stops at trial end',
);
const CANCEL = entry(
  'cancel.md',
  'title: Cancelling a subscription mid-period\nkeywords: cancel, cancels, cancelling, cancellation, subscription, mid-period, refund',
  '## Short answer\nAccess continues until the end of the period already paid for and no refund is issued.\n\n## What happens\n1. The subscription is flagged to stop at the end of the current period\n\n## Edge cases\n- Payment already overdue: the subscription is cancelled at once',
);
const PAYMENT = entry(
  'payment.md',
  'title: When a payment fails\nkeywords: failed payment, payment fails, declined, retry, retries, dunning, overdue, past due',
  '## Short answer\nA declined card is retried four times over ten days before access is suspended.\n\n## What happens\n1. The card is retried after one day\n\n## Edge cases\n- A customer who pays manually stops the retry sequence',
);

const index = createRetrievalIndex([TRIAL, CANCEL, PAYMENT]);

test('the stemmer unifies the forms an asker and an entry differ by', () => {
  assert.deepEqual(tokenize('cancelling'), tokenize('cancel'));
  assert.deepEqual(tokenize('cancels'), tokenize('cancel'));
  assert.deepEqual(tokenize('retries'), tokenize('retry'));
});

test('function words are dropped so they cannot match everything', () => {
  assert.deepEqual(tokenize('what happens when it is on the'), []);
});

test('a question phrased differently from the entry still finds it', () => {
  // None of these repeat the entry's own wording.
  assert.equal(index.best('am I charged when the free period finishes?')?.entry, TRIAL);
  assert.equal(index.best('if I stop my subscription mid-period do I keep access?')?.entry, CANCEL);
  assert.equal(index.best('my account is past due, what now?')?.entry, PAYMENT);
});

test('a question about something absent misses rather than guessing', () => {
  for (const question of [
    'what colour is the office carpet?',
    'how do gift cards work?',
    'who is the chief executive?',
    'can I export my data to a spreadsheet?',
  ]) {
    assert.equal(index.best(question), undefined, question);
  }
});

test('an empty or purely functional question matches nothing', () => {
  assert.equal(index.best(''), undefined);
  assert.equal(index.best('what happens?'), undefined);
});

test('a match must clear both the score and the coverage bar', () => {
  // One shared content word out of four is evidence of nothing.
  const weak = index.rank('what happens if I cancel halfway through the month?')[0];
  assert.ok(weak, 'expected the entry to be ranked at all');
  assert.ok(weak.coverage < 0.34, `coverage was ${weak.coverage}`);
  assert.equal(index.best('what happens if I cancel halfway through the month?'), undefined);
});

test('ranking prefers the entry that shares the most', () => {
  const ranked = index.rank('what happens when a free trial expires?');
  assert.equal(ranked[0]?.entry, TRIAL);
});

test('the uncertain band holds near misses, and nothing else', () => {
  // Shares one common word with the cancel entry and clears neither bar.
  const near = index.candidates('what happens if I cancel halfway through the month?');
  assert.equal(near.length >= 1, true);
  assert.equal(near[0]?.entry, CANCEL);

  // A confident hit needs no second opinion, so it is not in the band.
  const confident = index.candidates('what happens when a free trial expires?');
  assert.equal(confident.some((match) => match.entry === TRIAL), false);

  // Nothing shared at all means there is nothing to weigh.
  assert.deepEqual(index.candidates('what colour is the office carpet?'), []);
});

test('the band is capped so a judge is never handed the whole corpus', () => {
  assert.equal(index.candidates('cancel trial payment refund declined', 1).length <= 1, true);
});
