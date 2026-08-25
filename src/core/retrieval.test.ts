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

test('a question phrased differently from the entry still reaches it', () => {
  // Retrieval does not answer these; it narrows the field. The property that
  // matters is that the right entry is in the field at all.
  for (const [question, expected] of [
    ['am I charged when the free period finishes?', TRIAL],
    ['if I stop my subscription mid-period do I keep access?', CANCEL],
    ['my account is past due, what now?', PAYMENT],
  ] as const) {
    const shortlist = index.candidates(question);
    assert.ok(
      shortlist.some((match) => match.entry === expected),
      `${question} did not reach ${expected.file}`,
    );
  }
});

test('a question sharing no word with anything is not shortlisted', () => {
  const bigger = createRetrievalIndex([
    TRIAL, CANCEL, PAYMENT,
    entry('a.md', 'title: Changing a billing address\nkeywords: address', '## Short answer\nA billing address is changed from the account settings page.'),
    entry('b.md', 'title: Downloading an invoice\nkeywords: invoice', '## Short answer\nEvery invoice is available to download from the billing history.'),
    entry('c.md', 'title: Pausing an account\nkeywords: pause', '## Short answer\nAn account can be paused for up to three months.'),
  ]);

  assert.deepEqual(bigger.candidates('what colour is the office carpet?'), []);
  assert.deepEqual(bigger.candidates(''), []);
});

test('on a small knowledge base nothing is written off on lexical evidence alone', () => {
  // Three entries is too few for word statistics to mean much, so a question
  // that matches nothing is offered to the judge rather than declared absent.
  const nothing = index.candidates('what colour is the office carpet?');
  assert.equal(nothing.length, 3);
  assert.deepEqual(nothing.map((match) => match.score), [0, 0, 0]);
});

test('ranking prefers the entry that shares the most', () => {
  assert.equal(index.rank('what happens when a free trial expires?')[0]?.entry, TRIAL);
});

test('the shortlist is capped so a judge is never handed the whole corpus', () => {
  assert.ok(index.candidates('cancel trial payment refund declined', 1).length <= 1);
});
