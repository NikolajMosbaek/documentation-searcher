import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createCore } from './index.js';
import { createKnowledgeBase } from './knowledgeBase.js';
import { formatAnswer } from './answer.js';
import type { AnalysisEngine, Derivation } from './engine.js';
import type { SourceIndex } from './sourceIndex.js';

const QUESTION = 'how do gift cards work?';

function derivation(shortAnswer: string, fingerprint: string): Derivation {
  return {
    question: QUESTION,
    title: 'How a gift card is redeemed',
    keywords: ['gift card', 'voucher'],
    derivedFrom: ['billing.ts'],
    fingerprint,
    answer: { shortAnswer, behaviour: [], edgeCases: [], source: 'engine' },
  };
}

/** A fingerprint the test moves by hand, standing in for the codebase changing. */
function movableSources(): SourceIndex & { current: string } {
  return { current: 'aaaa', fingerprint() { return this.current; } } as SourceIndex & { current: string };
}

function counting(answers: () => Derivation | null) {
  let calls = 0;
  const engine: AnalysisEngine = { async deriveAnswer() { calls += 1; return answers(); } };
  return { engine, calls: () => calls };
}

function base() {
  const directory = mkdtempSync(join(tmpdir(), 'docsearch-core-'));
  return { directory, knowledgeBase: createKnowledgeBase(directory) };
}

const THREAD = { threadId: 't', turns: [] };

test('a question nothing covers is derived, stored, and then served from the store', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const { engine, calls } = counting(() => derivation('Credit is added to the balance.', sources.current));
  const core = createCore(knowledgeBase, engine, sources);

  const first = await core.ask(QUESTION, THREAD);
  assert.equal(first.source, 'engine');
  assert.equal(knowledgeBase.size, 1);

  const second = await core.ask(QUESTION, THREAD);
  assert.equal(second.source, 'knowledge-base');
  assert.equal(second.shortAnswer, first.shortAnswer);
  assert.equal(calls(), 1, 'the engine was asked twice for the same question');
  rmSync(directory, { recursive: true, force: true });
});

test('an engine that cannot answer misses honestly and stores nothing', async () => {
  const { directory, knowledgeBase } = base();
  const { engine, calls } = counting(() => null);
  const core = createCore(knowledgeBase, engine, movableSources());

  const answer = await core.ask('what colour is the office carpet?', THREAD);
  assert.equal(answer.source, 'miss');
  assert.equal(knowledgeBase.size, 0);
  assert.equal(calls(), 1);
  rmSync(directory, { recursive: true, force: true });
});

test('when the code behind an entry moves, the entry is derived again and refreshed in place', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  let text = 'Credit is added to the balance.';
  const { engine, calls } = counting(() => derivation(text, sources.current));
  const core = createCore(knowledgeBase, engine, sources);

  await core.ask(QUESTION, THREAD);
  const stored = knowledgeBase.find(QUESTION)!.file;

  sources.current = 'bbbb';
  text = 'Credit is added only after the code is verified.';
  const refreshed = await core.ask(QUESTION, THREAD);

  assert.equal(calls(), 2, 'the moved code did not trigger a re-derivation');
  assert.equal(refreshed.shortAnswer, text);
  assert.equal(knowledgeBase.size, 1, 'refreshing duplicated the entry');
  assert.equal(knowledgeBase.find(QUESTION)?.file, stored);

  const again = await core.ask(QUESTION, THREAD);
  assert.equal(again.source, 'knowledge-base');
  assert.equal(calls(), 2);
  rmSync(directory, { recursive: true, force: true });
});

test('an entry that cannot be refreshed is still answered, but never silently', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const stored = derivation('Credit is added to the balance.', sources.current);
  knowledgeBase.add(stored);

  sources.current = 'bbbb';
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, sources);
  const answer = await core.ask(QUESTION, THREAD);

  assert.equal(answer.source, 'stale');
  assert.equal(answer.shortAnswer, stored.answer.shortAnswer);
  assert.match(formatAnswer(answer), /possibly out of date/);
  rmSync(directory, { recursive: true, force: true });
});

test('a hand-written entry carries no fingerprint and is never called stale', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  knowledgeBase.add({ ...derivation('Credit is added.', ''), derivedFrom: [], fingerprint: '' });

  sources.current = 'something else entirely';
  const { engine, calls } = counting(() => null);
  const core = createCore(knowledgeBase, engine, sources);

  const answer = await core.ask(QUESTION, THREAD);
  assert.equal(answer.source, 'knowledge-base');
  assert.equal(calls(), 0, 'a hand-written entry was re-derived');
  rmSync(directory, { recursive: true, force: true });
});

test('with no codebase configured, stored answers are served as written', async () => {
  const { directory, knowledgeBase } = base();
  knowledgeBase.add(derivation('Credit is added to the balance.', 'aaaa'));
  const { engine, calls } = counting(() => null);
  const core = createCore(knowledgeBase, engine);

  const answer = await core.ask(QUESTION, THREAD);
  assert.equal(answer.source, 'knowledge-base');
  assert.equal(calls(), 0);
  rmSync(directory, { recursive: true, force: true });
});
