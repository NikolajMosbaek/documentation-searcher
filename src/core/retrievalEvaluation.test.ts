import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { DUPLICATE_SIMILARITY, loadKnowledgeBase, similarity } from './knowledgeBase.js';
import { createRetrievalIndex } from './retrieval.js';

/**
 * Retrieval measured against real entries rather than fixtures written to suit
 * it. Every file in `fixtures/corpus` was produced by this bot during a live
 * run, or is one of the hand-written examples this project ships -- including
 * two pairs the engine genuinely duplicated, and a mix of the entry format
 * before and after questions became a list.
 *
 * The bars were set from this corpus. These tests are what stops them drifting
 * back: the failure they guard against is silent, because a wrong answer served
 * confidently looks exactly like a right one.
 */
const CORPUS = join(import.meta.dirname, 'fixtures', 'corpus');
const entries = loadKnowledgeBase(CORPUS);
const index = createRetrievalIndex(entries);

const NO_ANSWER = [
  'answering-a-question-nothing-stored-covers.md',
  'what-happens-when-no-stored-answer-covers-a-question.md',
];
const STALE = [
  'refreshing-a-stored-answer-when-the-code-behind-it-has-chang.md',
  'what-happens-when-a-stored-answer-is-out-of-date.md',
];

/** Rephrasings: none repeats the wording of the entry that should answer it. */
const REPHRASINGS: Array<[string, string[]]> = [
  ['if the bot has never seen my question before, what does it do?', NO_ANSWER],
  ['is anything written down when it works out a new answer?', NO_ANSWER],
  ['can the bot edit my files?', ['the-assistant-only-reads-the-codebase-never-changes-it.md']],
  ['how does it know an answer went stale?', STALE],
  ['what if the analysis service is down?', ['what-the-bot-does-when-the-code-reading-service-is-unreachab.md']],
  ['how do I report a bad reply?', ['flagging-an-answer-as-wrong-in-the-conversation.md']],
  ['what happens if nobody points it at any source code?', ['behaviour-when-no-codebase-is-configured.md']],
  ['am I charged when my free period finishes?', ['trial-expiry.md']],
  ['if I stop my subscription mid-cycle do I keep access?', ['cancel-subscription-mid-period.md']],
  ['how many times is a declined card retried?', ['failed-payment-retry.md']],
];

/** Questions this knowledge base has no business answering. */
const UNRELATED = [
  'what colour is the office carpet?',
  'who is the chief executive?',
  'can I export my data to a spreadsheet?',
  'how do I change my billing address?',
  'what is the office wifi password?',
  'does the bot support Slack as well?',
  'how many people work here?',
];

test('the corpus is real, and big enough to mean something', () => {
  assert.ok(entries.length >= 12, `only ${entries.length} entries`);
  // Two behaviours are covered twice, by entries the engine wrote on different
  // runs. Retrieval has to cope with that, so the corpus keeps them.
  assert.equal(entries.filter((e) => NO_ANSWER.includes(e.file)).length, 2);
  assert.equal(entries.filter((e) => STALE.includes(e.file)).length, 2);
});

test('nothing is answered from an entry that does not answer it', () => {
  const wrong = REPHRASINGS.filter(([question, acceptable]) => {
    const served = index.best(question);
    return served !== undefined && !acceptable.includes(served.entry.file);
  }).map(([question]) => question);

  assert.deepEqual(wrong, [], 'served an entry that does not answer the question');
});

test('an unrelated question is never answered', () => {
  const answered = UNRELATED.filter((question) => index.best(question) !== undefined);
  assert.deepEqual(answered, [], 'answered a question this knowledge base does not cover');
});

test('whatever is not answered outright still reaches the judge with the right entry in it', () => {
  const unreachable = REPHRASINGS.filter(([question, acceptable]) => {
    if (index.best(question)) return false;
    const shortlist = index.candidates(question);
    return !shortlist.some((match) => acceptable.includes(match.entry.file));
  }).map(([question]) => question);

  // This is the property the whole arrangement depends on. Retrieval is allowed
  // to be unsure, but it is not allowed to lose the answer.
  assert.deepEqual(unreachable, [], 'the right entry was not in the shortlist');
});

test('a question sharing no words with anything is not even shortlisted', () => {
  // No judge call is worth paying for here; there is nothing to weigh.
  assert.deepEqual(index.candidates('what colour is the office carpet?'), []);
  assert.deepEqual(index.candidates('who is the chief executive?'), []);
});

/**
 * The merge threshold, measured against the two pairs in this corpus that the
 * engine genuinely produced for the same question on separate runs.
 */
test('real duplicates score above the merge bar, and nothing else does', () => {
  const DUPLICATES = [NO_ANSWER, STALE];
  const byFile = (file: string) => entries.find((e) => e.file === file)!;

  const duplicateScores = DUPLICATES.map(([a, b]) =>
    similarity(byFile(a!).answer.shortAnswer, byFile(b!).answer.shortAnswer),
  );

  const isDuplicatePair = (a: string, b: string) =>
    DUPLICATES.some((pair) => pair.includes(a) && pair.includes(b));

  const others: number[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i]!, b = entries[j]!;
      if (isDuplicatePair(a.file, b.file)) continue;
      others.push(similarity(a.answer.shortAnswer, b.answer.shortAnswer));
    }
  }

  const lowestDuplicate = Math.min(...duplicateScores);
  const highestOther = Math.max(...others);

  // Iteration 12's bar of 0.6 sat above both of these, so the merge it added
  // could never have fired on anything this engine actually produced.
  assert.ok(lowestDuplicate < 0.6, `a real duplicate scored ${lowestDuplicate.toFixed(3)}`);

  // The property the bar depends on: real duplicates and everything else are
  // separable at all.
  assert.ok(
    lowestDuplicate > highestOther,
    `duplicates bottom out at ${lowestDuplicate.toFixed(3)} but something else reached ${highestOther.toFixed(3)}`,
  );

  // And the bar actually in use sits inside that gap. Asserting the measured
  // values alone would let the constant be changed to anything without notice.
  assert.ok(
    highestOther < DUPLICATE_SIMILARITY && DUPLICATE_SIMILARITY <= lowestDuplicate,
    `the bar is ${DUPLICATE_SIMILARITY}, outside the measured gap ` +
      `${highestOther.toFixed(3)}..${lowestDuplicate.toFixed(3)}`,
  );
});
