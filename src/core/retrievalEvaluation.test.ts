import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { DUPLICATE_SIMILARITY, loadKnowledgeBase, similarity } from './knowledgeBase.js';
import { createRetrievalIndex } from './retrieval.js';
import { FLAGGING, NO_ANSWER, REPHRASINGS, STALE, UNRELATED } from './fixtures/labelledQuestions.js';

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

test('the corpus is real, and big enough to mean something', () => {
  assert.ok(entries.length >= 24, `only ${entries.length} entries`);
  // Two behaviours are covered twice, by entries the engine wrote on different
  // runs. Retrieval has to cope with that, so the corpus keeps them.
  for (const group of [NO_ANSWER, STALE, FLAGGING]) {
    assert.equal(entries.filter((e) => group.includes(e.file)).length, group.length, group.join(' / '));
  }
});

test('the right entry is always in the shortlist', () => {
  // The property the whole arrangement rests on. Retrieval is allowed to be
  // unsure -- it always is now -- but it is not allowed to lose the answer,
  // because the judge can only choose from what it is shown.
  const unreachable = REPHRASINGS.filter(([question, acceptable]) => {
    const shortlist = index.candidates(question);
    return !shortlist.some((match) => acceptable.includes(match.entry.file));
  }).map(([question]) => question);

  assert.deepEqual(unreachable, [], 'the right entry was not in the shortlist');
});

test('retrieval has no way to answer anything by itself', () => {
  // There is deliberately no `best`. Three thresholds that decided on lexical
  // evidence were measured at twelve entries, served nothing wrong, and served
  // two wrong answers when the corpus doubled. The interface no longer offers
  // the option.
  assert.equal('best' in index, false, 'retrieval can decide again');
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
  const DUPLICATES = [NO_ANSWER, STALE, FLAGGING];
  const byFile = (file: string) => entries.find((e) => e.file === file)!;

  // Every pair within a group of entries about the same behaviour.
  const duplicateScores = DUPLICATES.flatMap((group) =>
    group.flatMap((a, i) =>
      group.slice(i + 1).map((b) => similarity(byFile(a).answer.shortAnswer, byFile(b).answer.shortAnswer)),
    ),
  );

  const isDuplicatePair = (a: string, b: string) =>
    DUPLICATES.some((group) => group.includes(a) && group.includes(b));

  const others: number[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i]!, b = entries[j]!;
      if (isDuplicatePair(a.file, b.file)) continue;
      others.push(similarity(a.answer.shortAnswer, b.answer.shortAnswer));
    }
  }

  const lowestDuplicate = Math.min(...duplicateScores);
  const highestDuplicate = Math.max(...duplicateScores);
  const highestOther = Math.max(...others);

  // Merging must never join two entries that are not the same behaviour. This
  // is the property that has to hold; it is what makes an irreversible,
  // automatic decision acceptable.
  assert.ok(
    highestOther < DUPLICATE_SIMILARITY,
    `something that is not a duplicate scored ${highestOther.toFixed(3)}, at or above the bar of ${DUPLICATE_SIMILARITY}`,
  );

  // And the rule must still catch something, or it is dead code -- which is
  // exactly what it was before iteration 22.
  assert.ok(
    highestDuplicate >= DUPLICATE_SIMILARITY,
    `no real duplicate reaches the bar; the highest scored ${highestDuplicate.toFixed(3)}`,
  );

  // What is *not* asserted, because it is no longer true: that duplicates and
  // everything else are separable. At twenty-four entries the least alike pair
  // describing one behaviour scores about 0.18, below the most alike pair
  // describing two different ones at about 0.32. No threshold catches every
  // duplicate without merging things that are merely neighbours, so merging
  // catches the obvious cases and the rest accumulate.
  assert.ok(lowestDuplicate < highestOther, 'the distributions no longer overlap -- re-measure the bar');
});
