import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  createKnowledgeBase,
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
  assert.equal(entry.question, DERIVATION.question);
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

test('storing an entry never overwrites one that is already there', () => {
  const directory = emptyBase();
  const base = createKnowledgeBase(directory);

  const first = base.add(DERIVATION);
  const second = base.add({ ...DERIVATION, question: 'what is a voucher?' });

  assert.equal(first.file, `${slugify(DERIVATION.title)}.md`);
  assert.notEqual(second.file, first.file);
  assert.equal(base.size, 2);
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
