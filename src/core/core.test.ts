import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createCore } from './index.js';
import { noFollowUpResolver, type FollowUpResolver } from './followUp.js';
import { noJudge, type CandidateJudge } from './judge.js';
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
    costUsd: 1.25,
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
  const core = createCore(knowledgeBase, engine, { sources });

  const { answer: first } = await core.ask(QUESTION, THREAD);
  assert.equal(first.source, 'engine');
  assert.equal(knowledgeBase.size, 1);

  const { answer: second } = await core.ask(QUESTION, THREAD);
  assert.equal(second.source, 'knowledge-base');
  assert.equal(second.shortAnswer, first.shortAnswer);
  assert.equal(calls(), 1, 'the engine was asked twice for the same question');
  rmSync(directory, { recursive: true, force: true });
});

test('an engine that cannot answer misses honestly and stores nothing', async () => {
  const { directory, knowledgeBase } = base();
  const { engine, calls } = counting(() => null);
  const core = createCore(knowledgeBase, engine, { sources: movableSources() });

  const { answer: answer } = await core.ask('what colour is the office carpet?', THREAD);
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
  const core = createCore(knowledgeBase, engine, { sources });

  await core.ask(QUESTION, THREAD);
  const stored = knowledgeBase.find(QUESTION)!.file;

  sources.current = 'bbbb';
  text = 'Credit is added only after the code is verified.';
  const { answer: refreshed } = await core.ask(QUESTION, THREAD);

  assert.equal(calls(), 2, 'the moved code did not trigger a re-derivation');
  assert.equal(refreshed.shortAnswer, text);
  assert.equal(knowledgeBase.size, 1, 'refreshing duplicated the entry');
  assert.equal(knowledgeBase.find(QUESTION)?.file, stored);

  const { answer: again } = await core.ask(QUESTION, THREAD);
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
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, { sources });
  const { answer: answer } = await core.ask(QUESTION, THREAD);

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
  const core = createCore(knowledgeBase, engine, { sources });

  const { answer: answer } = await core.ask(QUESTION, THREAD);
  assert.equal(answer.source, 'knowledge-base');
  assert.equal(calls(), 0, 'a hand-written entry was re-derived');
  rmSync(directory, { recursive: true, force: true });
});

test('with no codebase configured, stored answers are served as written', async () => {
  const { directory, knowledgeBase } = base();
  knowledgeBase.add(derivation('Credit is added to the balance.', 'aaaa'));
  const { engine, calls } = counting(() => null);
  const core = createCore(knowledgeBase, engine);

  const { answer: answer } = await core.ask(QUESTION, THREAD);
  assert.equal(answer.source, 'knowledge-base');
  assert.equal(calls(), 0);
  rmSync(directory, { recursive: true, force: true });
});

test('a follow-up is resolved before anything else sees it', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const asked: string[] = [];
  const { engine } = counting(() => derivation('Credit is added.', sources.current));
  const resolver: FollowUpResolver = {
    async resolve() { return 'What happens to a gift card balance when the account closes?'; },
  };
  const core = createCore(knowledgeBase, {
    async deriveAnswer(q) { asked.push(q); return engine.deriveAnswer(q); },
  }, { sources, resolver });

  // A thread with history, then a question that leans on it.
  const thread = { threadId: 't', turns: [{ question: 'how do gift cards work?', resolved: 'how do gift cards work?', answeredFrom: 'engine' as const }] };
  const exchange = await core.ask('and what if they close the account?', thread);

  assert.equal(exchange.question, 'What happens to a gift card balance when the account closes?');
  assert.deepEqual(asked, ['What happens to a gift card balance when the account closes?']);
  // The entry is stored under the question that stands alone, not the fragment.
  assert.deepEqual(knowledgeBase.find('What happens to a gift card balance when the account closes?')?.questions,
    ['What happens to a gift card balance when the account closes?']);
  rmSync(directory, { recursive: true, force: true });
});

test('the first question in a thread is never rewritten', async () => {
  const { directory, knowledgeBase } = base();
  let resolverCalls = 0;
  const resolver: FollowUpResolver = {
    async resolve(question) { resolverCalls += 1; return question; },
  };
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, { sources: movableSources(), resolver });

  // Reads as dependent, but there is nothing to depend on.
  const exchange = await core.ask('and what about them?', { threadId: 't', turns: [] });
  assert.equal(resolverCalls, 0);
  assert.equal(exchange.question, 'and what about them?');
  rmSync(directory, { recursive: true, force: true });
});

test('a self-contained question mid-thread is not sent for rewriting', async () => {
  const { directory, knowledgeBase } = base();
  let resolverCalls = 0;
  const resolver: FollowUpResolver = {
    async resolve(question) { resolverCalls += 1; return question; },
  };
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, { sources: movableSources(), resolver });
  const thread = { threadId: 't', turns: [{ question: 'first', resolved: 'first', answeredFrom: 'engine' as const }] };

  await core.ask('What happens when a customer redeems a voucher at checkout?', thread);
  assert.equal(resolverCalls, 0, 'a standalone question was sent for rewriting');
  rmSync(directory, { recursive: true, force: true });
});

test('a resolver that fails leaves the question exactly as asked', async () => {
  const { directory, knowledgeBase } = base();
  const failing: FollowUpResolver = { async resolve(question) { return question; } };
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, { sources: movableSources(), resolver: failing });
  const thread = { threadId: 't', turns: [{ question: 'first', resolved: 'first', answeredFrom: 'engine' as const }] };

  const exchange = await core.ask('and them?', thread);
  assert.equal(exchange.question, 'and them?');
  assert.equal(exchange.answer.source, 'miss');
  rmSync(directory, { recursive: true, force: true });
});

test('with no resolver configured, nothing is rewritten', async () => {
  const { directory, knowledgeBase } = base();
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, { sources: movableSources(), resolver: noFollowUpResolver });
  const thread = { threadId: 't', turns: [{ question: 'first', resolved: 'first', answeredFrom: 'engine' as const }] };

  const exchange = await core.ask('and them?', thread);
  assert.equal(exchange.question, 'and them?');
  rmSync(directory, { recursive: true, force: true });
});

test('flagging an answer as wrong re-reads the code and replaces the entry', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const seen: Array<string | undefined> = [];
  let text = 'Credit is added to the balance.';
  const engine: AnalysisEngine = {
    async deriveAnswer(_q, guidance) { seen.push(guidance); return derivation(text, sources.current); },
  };
  const core = createCore(knowledgeBase, engine, { sources });

  const first = await core.ask(QUESTION, THREAD);
  const stored = first.entryFile!;
  assert.ok(stored, 'the first answer did not record which entry it came from');

  text = 'Credit is added only once the code has been verified.';
  const thread = {
    threadId: 't',
    turns: [{ question: QUESTION, resolved: QUESTION, answeredFrom: 'engine' as const, entryFile: stored }],
  };
  const corrected = await core.ask('that is wrong, it needs verifying first', thread);

  assert.equal(corrected.answer.source, 'corrected');
  assert.equal(corrected.answer.shortAnswer, text);
  assert.equal(corrected.question, QUESTION, 'the dispute was treated as a new question');
  assert.equal(knowledgeBase.size, 1, 'correcting duplicated the entry');
  assert.equal(knowledgeBase.byFile(stored)?.answer.shortAnswer, text);

  // The objection reached the engine as guidance, not as the question.
  assert.equal(seen.length, 2);
  assert.equal(seen[0], undefined);
  assert.match(seen[1]!, /it needs verifying first/);
  assert.match(seen[1]!, /not evidence/);
  rmSync(directory, { recursive: true, force: true });
});

test('a dispute the code does not support leaves the answer standing', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const original = 'Credit is added to the balance.';
  // The engine re-reads and reports the same thing: the objector was mistaken.
  const core = createCore(knowledgeBase, {
    async deriveAnswer() { return derivation(original, sources.current); },
  }, { sources });

  const first = await core.ask(QUESTION, THREAD);
  const thread = {
    threadId: 't',
    turns: [{ question: QUESTION, resolved: QUESTION, answeredFrom: 'engine' as const, entryFile: first.entryFile }],
  };
  const corrected = await core.ask('no, that is wrong', thread);

  assert.equal(corrected.answer.shortAnswer, original);
  assert.equal(knowledgeBase.size, 1);
  rmSync(directory, { recursive: true, force: true });
});

test('a dispute the code cannot be re-read for changes nothing', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const stored = knowledgeBase.add(derivation('Credit is added to the balance.', sources.current));
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, { sources });

  const thread = {
    threadId: 't',
    turns: [{ question: QUESTION, resolved: QUESTION, answeredFrom: 'knowledge-base' as const, entryFile: stored.file }],
  };
  const answer = await core.ask('that is wrong', thread);

  assert.match(answer.answer.shortAnswer, /could not read the code again/);
  assert.equal(knowledgeBase.byFile(stored.file)?.answer.shortAnswer, 'Credit is added to the balance.');
  rmSync(directory, { recursive: true, force: true });
});

test('a dispute with no previous turn is treated as an ordinary question', async () => {
  const { directory, knowledgeBase } = base();
  let asked: string | undefined;
  const core = createCore(knowledgeBase, {
    async deriveAnswer(q) { asked = q; return null; },
  }, { sources: movableSources() });

  await core.ask('that is wrong', { threadId: 't', turns: [] });
  assert.equal(asked, 'that is wrong');
  rmSync(directory, { recursive: true, force: true });
});

/** A knowledge base holding one entry that lexical retrieval will not be sure about. */
async function withNearMiss() {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  knowledgeBase.add({
    ...derivation('Access continues until the end of the period already paid for.', sources.current),
    question: 'what happens if I cancel mid-period?',
    title: 'Cancelling a subscription mid-period',
    keywords: ['cancel', 'mid-period', 'subscription'],
  });
  return { directory, knowledgeBase, sources };
}

const REPHRASED = 'what happens if I cancel halfway through the month?';

test('a near miss retrieval cannot decide is put to the judge, not to the engine', async () => {
  const { directory, knowledgeBase, sources } = await withNearMiss();
  let offered: string[] = [];
  const { engine, calls } = counting(() => derivation('fresh', sources.current));
  const judge: CandidateJudge = {
    async choose(_q, candidates) { offered = candidates.map((c) => c.title); return candidates[0]; },
  };
  const core = createCore(knowledgeBase, engine, { sources, judge });

  const { answer } = await core.ask(REPHRASED, THREAD);
  assert.deepEqual(offered, ['Cancelling a subscription mid-period']);
  assert.equal(answer.source, 'knowledge-base');
  assert.equal(calls(), 0, 'a derivation was paid for despite a usable stored answer');
  rmSync(directory, { recursive: true, force: true });
});

test('a judge that declines lets the question be derived properly', async () => {
  const { directory, knowledgeBase, sources } = await withNearMiss();
  const { engine, calls } = counting(() => derivation('fresh', sources.current));
  const core = createCore(knowledgeBase, engine, {
    sources,
    judge: { async choose() { return undefined; } },
  });

  const { answer } = await core.ask(REPHRASED, THREAD);
  assert.equal(answer.source, 'engine');
  assert.equal(calls(), 1);
  rmSync(directory, { recursive: true, force: true });
});

test('with no judge configured a near miss is derived, as before', async () => {
  const { directory, knowledgeBase, sources } = await withNearMiss();
  const { engine, calls } = counting(() => derivation('fresh', sources.current));
  const core = createCore(knowledgeBase, engine, { sources, judge: noJudge });

  await core.ask(REPHRASED, THREAD);
  assert.equal(calls(), 1);
  rmSync(directory, { recursive: true, force: true });
});

test('the judge is not consulted when retrieval is already sure', async () => {
  const { directory, knowledgeBase, sources } = await withNearMiss();
  let consulted = 0;
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, {
    sources,
    judge: { async choose() { consulted += 1; return undefined; } },
  });

  await core.ask('what happens if I cancel mid-period?', THREAD);
  assert.equal(consulted, 0, 'a confident hit was sent for a second opinion');
  rmSync(directory, { recursive: true, force: true });
});

test('the judge is not consulted when nothing is close, once there is a corpus', async () => {
  const { directory, knowledgeBase, sources } = await withNearMiss();
  // Past the point where word statistics are too thin to be trusted.
  for (let i = 0; i < 6; i += 1) {
    knowledgeBase.add({
      ...derivation(`Unrelated behaviour number ${i} concerning shipping labels.`, sources.current),
      question: `how does shipping label ${i} work?`,
      title: `Shipping labels ${i}`,
      keywords: [`shipping ${i}`],
      fingerprint: `fingerprint-${i}`,
    });
  }

  let consulted = 0;
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, {
    sources,
    judge: { async choose() { consulted += 1; return undefined; } },
  });

  await core.ask('what colour is the office carpet?', THREAD);
  assert.equal(consulted, 0, 'the judge was asked to weigh nothing');
  rmSync(directory, { recursive: true, force: true });
});

test('on a small knowledge base a question matching nothing still gets a second opinion', async () => {
  const { directory, knowledgeBase, sources } = await withNearMiss();
  let offered = 0;
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, {
    sources,
    judge: { async choose(_q, candidates) { offered = candidates.length; return undefined; } },
  });

  // One entry: lexical scoring has nothing to say, so it must not be the thing
  // that decides. Cents to ask, against a dollar to derive.
  await core.ask('what colour is the office carpet?', THREAD);
  assert.equal(offered, 1, 'a small corpus was written off without a second opinion');
  rmSync(directory, { recursive: true, force: true });
});

test('an entry the judge rescued is still checked for staleness', async () => {
  const { directory, knowledgeBase, sources } = await withNearMiss();
  let text = 'Access now ends immediately on cancellation.';
  const { engine, calls } = counting(() => derivation(text, sources.current));
  const core = createCore(knowledgeBase, engine, {
    sources,
    judge: { async choose(_q, candidates) { return candidates[0]; } },
  });

  sources.current = 'the code has moved';
  const { answer } = await core.ask(REPHRASED, THREAD);

  assert.equal(calls(), 1, 'a rescued entry skipped the staleness check');
  assert.equal(answer.shortAnswer, text);
  rmSync(directory, { recursive: true, force: true });
});

test('what reading the codebase cost is added up and can be read back', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const { engine } = counting(() => derivation('Credit is added.', sources.current));
  const core = createCore(knowledgeBase, engine, { sources });

  assert.equal(core.spentUsd(), 0);

  await core.ask(QUESTION, THREAD);
  assert.equal(core.spentUsd(), 1.25);

  // A stored answer is free, so the total must not move.
  await core.ask(QUESTION, THREAD);
  assert.equal(core.spentUsd(), 1.25);

  // A refresh reads the codebase again, so it must.
  sources.current = 'moved';
  await core.ask(QUESTION, THREAD);
  assert.equal(core.spentUsd(), 2.5);
  rmSync(directory, { recursive: true, force: true });
});

test('an engine that reports no cost does not break the total', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const core = createCore(knowledgeBase, {
    async deriveAnswer() {
      const { costUsd, ...free } = derivation('Credit is added.', sources.current);
      void costUsd;
      return free;
    },
  }, { sources });

  await core.ask(QUESTION, THREAD);
  assert.equal(core.spentUsd(), 0);
  rmSync(directory, { recursive: true, force: true });
});

test('flagging the same answer repeatedly does not read the codebase each time', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const { engine, calls } = counting(() => derivation('Credit is added.', sources.current));
  const core = createCore(knowledgeBase, engine, { sources });

  const first = await core.ask(QUESTION, THREAD);
  const thread = {
    threadId: 't',
    turns: [{ question: QUESTION, resolved: QUESTION, answeredFrom: 'engine' as const, entryFile: first.entryFile }],
  };

  await core.ask('that is wrong', thread);
  assert.equal(calls(), 2, 'the first flag should read the codebase');

  const again = await core.ask('no, that is wrong', thread);
  assert.equal(calls(), 2, 'the second flag read the codebase again');
  assert.match(again.answer.shortAnswer, /very recently/);
  rmSync(directory, { recursive: true, force: true });
});

test('once the cooldown has passed, flagging reads the codebase again', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const { engine, calls } = counting(() => derivation('Credit is added.', sources.current));
  const core = createCore(knowledgeBase, engine, { sources, disputeCooldownMs: 0 });

  const first = await core.ask(QUESTION, THREAD);
  const thread = {
    threadId: 't',
    turns: [{ question: QUESTION, resolved: QUESTION, answeredFrom: 'engine' as const, entryFile: first.entryFile }],
  };

  await core.ask('that is wrong', thread);
  await core.ask('that is wrong', thread);
  assert.equal(calls(), 3, 'a zero cooldown should not block anything');
  rmSync(directory, { recursive: true, force: true });
});

test('spend is attributed to the conversation that caused it', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const { engine } = counting(() => derivation('Credit is added.', sources.current));
  const core = createCore(knowledgeBase, engine, { sources });

  await core.ask('how do gift cards work?', { threadId: 'support-1', turns: [] });
  await core.ask('when does a voucher expire?', { threadId: 'support-2', turns: [] });
  await core.ask('what happens to an unused balance?', { threadId: 'support-2', turns: [] });

  const spend = core.spendByThread();
  assert.deepEqual(spend.map((t) => t.threadId), ['support-2', 'support-1'], 'not sorted by cost');
  assert.equal(spend[0]?.reads, 2);
  assert.equal(spend[0]?.costUsd, 2.5);
  assert.equal(spend[1]?.reads, 1);
  assert.equal(spend[1]?.costUsd, 1.25);
  assert.equal(core.spentUsd(), 3.75, 'the parts do not add up to the whole');
  rmSync(directory, { recursive: true, force: true });
});

test('a conversation answered entirely from the store never appears', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  knowledgeBase.add(derivation('Credit is added.', sources.current));
  const core = createCore(knowledgeBase, { async deriveAnswer() { return null; } }, { sources });

  await core.ask(QUESTION, { threadId: 'free-thread', turns: [] });
  assert.deepEqual(core.spendByThread(), [], 'a free answer was recorded as spend');
  rmSync(directory, { recursive: true, force: true });
});

test('a dispute is charged to the thread it was raised in', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const { engine } = counting(() => derivation('Credit is added.', sources.current));
  const core = createCore(knowledgeBase, engine, { sources });

  const first = await core.ask(QUESTION, { threadId: 'asked-here', turns: [] });
  await core.ask('that is wrong', {
    threadId: 'disputed-there',
    turns: [{ question: QUESTION, resolved: QUESTION, answeredFrom: 'engine', entryFile: first.entryFile }],
  });

  const spend = core.spendByThread();
  assert.deepEqual(spend.map((t) => t.threadId).sort(), ['asked-here', 'disputed-there']);
  assert.equal(spend.find((t) => t.threadId === 'disputed-there')?.reads, 1);
  rmSync(directory, { recursive: true, force: true });
});

test('the breakdown cannot be mutated by whoever reads it', async () => {
  const { directory, knowledgeBase } = base();
  const sources = movableSources();
  const { engine } = counting(() => derivation('Credit is added.', sources.current));
  const core = createCore(knowledgeBase, engine, { sources });

  await core.ask(QUESTION, THREAD);
  const spend = core.spendByThread();
  spend[0]!.costUsd = 999;

  assert.equal(core.spendByThread()[0]?.costUsd, 1.25, 'the internal tally was writable from outside');
  rmSync(directory, { recursive: true, force: true });
});
