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

test('a question phrased differently from the entry reaches it, for the judge to confirm', () => {
  // These do not repeat the entry's wording, so they are not served on lexical
  // evidence alone -- they are shortlisted, and the judge decides. What matters
  // is that the right entry is in the shortlist at all.
  for (const [question, expected] of [
    ['am I charged when the free period finishes?', TRIAL],
    ['if I stop my subscription mid-period do I keep access?', CANCEL],
    ['my account is past due, what now?', PAYMENT],
  ] as const) {
    const shortlist = index.candidates(question);
    const served = index.best(question);
    const reachable = served === undefined
      ? shortlist.some((match) => match.entry === expected)
      : served.entry === expected;
    assert.ok(reachable, `${question} could not reach ${expected.file}`);
  }
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

test('the uncertain band holds near misses, not confident hits', () => {
  const near = index.candidates('what happens if I cancel halfway through the month?');
  assert.equal(near.length >= 1, true);
  assert.equal(near[0]?.entry, CANCEL);

  // A confident hit needs no second opinion, so it is not in the band.
  const confident = index.candidates('what happens when a free trial expires?');
  assert.equal(confident.some((match) => match.entry === TRIAL), false);
});

test('on a small knowledge base nothing is written off on lexical evidence alone', () => {
  // Three entries is too few for word statistics to mean much, so a question
  // that matches nothing is offered to the judge rather than declared absent.
  const nothing = index.candidates('what colour is the office carpet?');
  assert.equal(nothing.length, 3, 'a small corpus should offer everything for a second opinion');
  assert.deepEqual(nothing.map((match) => match.score), [0, 0, 0]);
});

test('on a larger knowledge base an unrelated question is written off', () => {
  const many = createRetrievalIndex([
    TRIAL, CANCEL, PAYMENT,
    entry('a.md', 'title: Changing a billing address\nkeywords: address, billing address', '## Short answer\nA billing address is changed from the account settings page.'),
    entry('b.md', 'title: Downloading an invoice\nkeywords: invoice, receipt, download', '## Short answer\nEvery invoice is available to download from the billing history.'),
    entry('c.md', 'title: Pausing an account\nkeywords: pause, suspend, hold', '## Short answer\nAn account can be paused for up to three months.'),
  ]);

  assert.deepEqual(many.candidates('what colour is the office carpet?'), []);
});

test('the band is capped so a judge is never handed the whole corpus', () => {
  assert.equal(index.candidates('cancel trial payment refund declined', 1).length <= 1, true);
});

test('an entry barely ahead of the next one is not served on its own', () => {
  // Two entries about refunds for different reasons, plus one unrelated so that
  // "refund" is not in every entry and therefore still carries weight. Whichever
  // ranks first for a general refund question does so by a hair.
  const cancelled = entry('a.md', 'title: Refunding a cancelled subscription\nkeywords: refund, cancelled',
    '## Short answer\nA cancelled subscription is refunded when it is cancelled within fourteen days.');
  const duplicate = entry('b.md', 'title: Refunding a duplicate charge\nkeywords: refund, duplicate',
    '## Short answer\nA duplicate charge is refunded in full once it is reported.');
  const unrelated = entry('c.md', 'title: When a free trial ends\nkeywords: trial, expiry',
    '## Short answer\nA trial converts to a paid subscription automatically unless cancelled.');
  const close = createRetrievalIndex([cancelled, duplicate, unrelated]);

  const ranked = close.rank('when is a refund given?');
  assert.ok(ranked.length >= 2, 'expected both refund entries to rank');

  const margin = ranked[0]!.score / ranked[1]!.score;
  assert.ok(margin < 1.1, `margin was ${margin.toFixed(2)}, so this is not testing a close call`);

  assert.equal(close.best('when is a refund given?'), undefined, 'a coin toss was served as an answer');
  assert.ok(close.candidates('when is a refund given?').length >= 2, 'both should go to the judge');
});
