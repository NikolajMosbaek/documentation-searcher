import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  createKnowledgeBase,
  isDuplicate,
  similarity,
  loadKnowledgeBase,
  normalizeQuestion,
  parseEntry,
  serializeEntry,
  slugify,
} from './knowledgeBase.js';
import type { Derivation } from './engine.js';

const DERIVATION: Derivation = {
  question: 'how do gift cards work?',
  title: 'How a gift card is redeemed',
  keywords: ['gift card', 'gift cards', 'voucher'],
  derivedFrom: ['src/billing/giftCard.ts', 'src/billing/ledger.ts'],
  fingerprint: '8e923ebab910d61b',
  answer: {
    shortAnswer: 'A gift card is redeemed by entering its code, which adds credit to the balance.',
    behaviour: ['The customer enters the code at checkout', 'The value is added to the balance'],
    edgeCases: ['A code already redeemed is rejected and nothing is added'],
    source: 'engine',
  },
};

function emptyBase(): string {
  return mkdtempSync(join(tmpdir(), 'docsearch-kb-'));
}

test('what the bot writes, the parser reads back unchanged', () => {
  const entry = parseEntry('gift.md', serializeEntry(DERIVATION));

  assert.equal(entry.title, DERIVATION.title);
  assert.deepEqual(entry.questions, [DERIVATION.question]);
  assert.equal(entry.fingerprint, DERIVATION.fingerprint);
  assert.deepEqual(entry.keywords, DERIVATION.keywords);
  assert.deepEqual(entry.derivedFrom, DERIVATION.derivedFrom);
  assert.equal(entry.answer.shortAnswer, DERIVATION.answer.shortAnswer);
  assert.deepEqual(entry.answer.behaviour, DERIVATION.answer.behaviour);
  assert.deepEqual(entry.answer.edgeCases, DERIVATION.answer.edgeCases);
});

test('newlines and commas from the model do not corrupt the round trip', () => {
  const awkward: Derivation = {
    ...DERIVATION,
    title: 'A title\nsplit over lines',
    keywords: ['one, with a comma', 'two'],
    answer: { ...DERIVATION.answer, shortAnswer: 'A sentence\nbroken\nacross lines.' },
  };
  const entry = parseEntry('awkward.md', serializeEntry(awkward));

  assert.equal(entry.title, 'A title split over lines');
  assert.equal(entry.answer.shortAnswer, 'A sentence broken across lines.');
  assert.deepEqual(entry.keywords, ['one with a comma', 'two']);
});

test('a malformed entry is skipped rather than taking the knowledge base down', () => {
  const directory = emptyBase();
  writeFileSync(join(directory, 'good.md'), serializeEntry(DERIVATION));
  writeFileSync(join(directory, 'broken.md'), 'no frontmatter here at all\n');
  writeFileSync(join(directory, 'headless.md'), '---\ntitle: A title\n---\n\nno short answer section\n');

  const entries = loadKnowledgeBase(directory);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.title, DERIVATION.title);
  rmSync(directory, { recursive: true, force: true });
});

test('the same behaviour asked twice becomes one entry with both questions', () => {
  const directory = emptyBase();
  const base = createKnowledgeBase(directory);

  const first = base.add(DERIVATION);
  const second = base.add({ ...DERIVATION, question: 'what is a voucher worth?' });

  assert.equal(second.file, first.file, 'a near-duplicate entry was created');
  assert.equal(base.size, 1);
  assert.deepEqual(second.questions, ['how do gift cards work?', 'what is a voucher worth?']);

  // Both phrasings now reach it, which is the point of merging rather than
  // simply discarding the second derivation.
  assert.equal(base.find('how do gift cards work?')?.file, first.file);
  assert.equal(base.find('what is a voucher worth?')?.file, first.file);
  rmSync(directory, { recursive: true, force: true });
});

test('a different behaviour from the same code is kept separate', () => {
  const directory = emptyBase();
  const base = createKnowledgeBase(directory);

  const first = base.add(DERIVATION);
  // Same files, same fingerprint, but plainly not the same behaviour.
  const other = base.add({
    ...DERIVATION,
    question: 'when does a gift card expire?',
    answer: {
      ...DERIVATION.answer,
      shortAnswer: 'An unused gift card expires two years after it was issued.',
    },
  });

  assert.notEqual(other.file, first.file, 'two different behaviours were merged');
  assert.equal(base.size, 2);
  rmSync(directory, { recursive: true, force: true });
});

test('an entry derived from different code is never merged away', () => {
  const directory = emptyBase();
  const base = createKnowledgeBase(directory);

  const first = base.add(DERIVATION);
  // Word-for-word identical, but derived from somewhere else entirely.
  const elsewhere = base.add({ ...DERIVATION, question: 'and in the old system?', fingerprint: 'ffffffffffffffff' });

  assert.notEqual(elsewhere.file, first.file);
  assert.equal(base.size, 2);
  rmSync(directory, { recursive: true, force: true });
});

test('a title collision between different behaviours does not overwrite', () => {
  const directory = emptyBase();
  const base = createKnowledgeBase(directory);

  const first = base.add(DERIVATION);
  const clashing = base.add({
    ...DERIVATION,
    question: 'when does a gift card expire?',
    answer: { ...DERIVATION.answer, shortAnswer: 'An unused gift card expires after two years.' },
  });

  assert.equal(first.file, 'how-a-gift-card-is-redeemed.md');
  assert.equal(clashing.file, 'how-a-gift-card-is-redeemed-2.md');
  rmSync(directory, { recursive: true, force: true });
});

test('refreshing an entry rewrites the same file instead of adding another', () => {
  const directory = emptyBase();
  const base = createKnowledgeBase(directory);
  const stored = base.add(DERIVATION);

  const refreshed = base.replace(stored, {
    ...DERIVATION,
    fingerprint: 'ffffffffffffffff',
    answer: { ...DERIVATION.answer, shortAnswer: 'A gift card now requires verification first.' },
  });

  assert.equal(refreshed.file, stored.file);
  assert.equal(base.size, 1);
  assert.match(readFileSync(join(directory, stored.file), 'utf8'), /requires verification first/);
  rmSync(directory, { recursive: true, force: true });
});

test('the question that paid for an entry always finds it again', () => {
  const directory = emptyBase();
  const base = createKnowledgeBase(directory);
  // Keywords deliberately share no word with the question, which is what the
  // real engine produces and what silently broke this before.
  base.add({
    ...DERIVATION,
    question: 'What does the bot do when the analysis service is unreachable?',
    title: 'Behaviour when analysis is unavailable',
    keywords: ['degradation', 'outage', 'fallback posture'],
  });

  const found = base.find('What does the bot do when the analysis service is unreachable?');
  assert.ok(found, 'the question that created the entry could not find it');
  assert.equal(base.find('  what does the BOT do when the Analysis Service is unreachable?!  '), found);
  rmSync(directory, { recursive: true, force: true });
});

test('normalising a question ignores case, punctuation and spacing', () => {
  assert.equal(normalizeQuestion('  Does it WORK?! '), normalizeQuestion('does it work'));
});

test('similarity ignores word order and repetition', () => {
  assert.equal(similarity('the card adds credit', 'credit the card adds'), 1);
  assert.equal(similarity('', 'anything at all'), 0);
  assert.equal(similarity('a gift card adds credit', 'access ends at the period end'), 0);
});

test('the merge threshold separates a re-wording from a different behaviour', () => {
  // A re-wording of the same behaviour, at about 0.64. Real re-derivations
  // measured later score lower than this -- 0.18 to 0.89 -- so treat this as a
  // constructed example rather than a typical one.
  const rewording = similarity(
    'Access continues until the end of the period already paid for, and no refund is issued.',
    'Access continues to the end of the period the customer already paid for; no refund is given.',
  );
  assert.ok(rewording > 0.6, `a re-wording scored ${rewording.toFixed(3)} and would not merge`);

  // Two genuinely different behaviours, which must stay apart.
  const different = similarity(
    'An unused gift card expires two years after it was issued.',
    'A gift card is redeemed by entering its code, which adds credit to the balance.',
  );
  assert.ok(different < 0.3, `different behaviours scored ${different.toFixed(3)}`);
});

test('sameness needs both the same code and the same meaning', () => {
  const entry = parseEntry('gift.md', serializeEntry(DERIVATION));

  assert.equal(isDuplicate(entry, DERIVATION), true);
  assert.equal(isDuplicate(entry, { ...DERIVATION, fingerprint: 'ffffffffffffffff' }), false);
  assert.equal(
    isDuplicate(entry, {
      ...DERIVATION,
      answer: { ...DERIVATION.answer, shortAnswer: 'Access ends at the end of the paid period.' },
    }),
    false,
  );
});

test('a hand-written entry, having no fingerprint, is never merged into', () => {
  const handWritten = parseEntry(
    'hand.md',
    '---\ntitle: Written by a person\n---\n\n## Short answer\nA gift card is redeemed by entering its code, which adds credit to the balance.\n',
  );
  assert.equal(isDuplicate(handWritten, DERIVATION), false);
});
