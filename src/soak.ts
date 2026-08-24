import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createClaudeEngine,
  createClaudeJudge,
  createClaudeResolver,
  createCore,
  createKnowledgeBase,
  createSourceIndex,
  formatAnswer,
  InMemoryThreadStore,
} from './core/index.js';
import { DEFAULT_SCENARIO, parseScenario, type SoakScenario } from './soakScenario.js';

/**
 * One realistic session, end to end, against a real codebase.
 *
 * `npm test` covers each mechanism in isolation with fakes. This covers them
 * together with the real ones, which is where every integration bug in this
 * project has actually lived -- an entry that could not be found by the
 * question that created it, an entry stored under the wrong question, a refresh
 * that spent money without recording it, and a message that contradicted its
 * own warning.
 *
 * It reads a real codebase several times, so it costs real money -- two or
 * three dollars -- and takes a few minutes. It is not part of `npm test` for
 * exactly that reason.
 */
const CODEBASE = process.env.DOCSEARCHER_CODEBASE;
if (!CODEBASE) {
  console.error('Set DOCSEARCHER_CODEBASE to a codebase to run the soak against.');
  console.error('It will be copied first; the original is never modified.');
  process.exit(2);
}

// The built-in questions are about this project. Pointed at anything else, the
// soak needs questions that codebase can actually answer, or every turn misses
// and the checks fail for reasons that are not defects.
const SCENARIO_FILE = process.env.DOCSEARCHER_SOAK_SCENARIO;
let scenario: SoakScenario;
try {
  scenario = SCENARIO_FILE
    ? parseScenario(readFileSync(SCENARIO_FILE, 'utf8'), SCENARIO_FILE)
    : DEFAULT_SCENARIO;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const QUESTION = scenario.question;

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -- ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// The soak edits a source file to trigger staleness, so it works on a copy.
const workspace = mkdtempSync(join(tmpdir(), 'docsearch-soak-'));
const code = join(workspace, 'code');
const knowledge = join(workspace, 'knowledge-base');
// node_modules would be copied too, which is slow and pointless for reading.
cpSync(CODEBASE, code, { recursive: true, filter: (source) => !source.includes('node_modules') });
mkdirSync(knowledge, { recursive: true });

// Every soak until now began with nothing stored. That is the easiest state to
// reason about and the least like a running deployment -- and it is exactly the
// state that hid a serious over-matching bug, because a knowledge base holding
// a few unrelated entries behaves differently from one holding none.
const SEED = process.env.DOCSEARCHER_SOAK_SEED;
if (SEED) {
  if (!existsSync(SEED)) {
    console.error(`No such directory to seed from: ${SEED}`);
    process.exit(2);
  }
  cpSync(SEED, knowledge, { recursive: true });
}

const knowledgeBase = createKnowledgeBase(knowledge);
const sources = createSourceIndex(code);
const core = createCore(
  knowledgeBase,
  createClaudeEngine({ codebase: code, model: process.env.DOCSEARCHER_MODEL ?? 'claude-opus-5' }),
  {
    sources,
    resolver: createClaudeResolver({ cwd: code }),
    judge: createClaudeJudge({ cwd: code }),
  },
);
const threads = new InMemoryThreadStore();

async function turn(asked: string) {
  const started = Date.now();
  const before = core.spentUsd();
  const exchange = await core.ask(asked, threads.get('soak'));
  threads.record('soak', {
    question: asked,
    resolved: exchange.question,
    answeredFrom: exchange.answer.source,
    entryFile: exchange.entryFile,
  });
  const paid = core.spentUsd() - before;
  console.log(`\n> ${asked}`);
  console.log(
    `  ${exchange.answer.source}  ${Math.round((Date.now() - started) / 1000)}s  $${paid.toFixed(4)}  entries=${knowledgeBase.size}`,
  );
  return { ...exchange, paid };
}

console.log(`Soaking against a copy of ${CODEBASE}`);
console.log(`Knowledge base starts ${SEED ? `seeded from ${SEED}` : 'empty'}`);
console.log(`Questions from ${SCENARIO_FILE ?? 'the built-in scenario, which is about this project'}`);
console.log('This costs a few dollars and takes a few minutes.\n');

const seeded = knowledgeBase.size;
if (seeded > 0) console.log(`(${seeded} entries already stored)\n`);

// A question about this codebase, against entries about something else. If a
// stored answer is served here, the bot is answering a question nobody asked.
const cold = await turn(QUESTION);
check('a question the stored entries do not cover is derived', cold.answer.source === 'engine', cold.answer.source);
check('and stored', knowledgeBase.size === seeded + 1 && Boolean(cold.entryFile));
check('and it cost real money', cold.paid > 0, `$${cold.paid.toFixed(4)}`);

const repeat = await turn(QUESTION);
check('the same question is free', repeat.answer.source === 'knowledge-base' && repeat.paid === 0);

const rephrased = await turn(scenario.rephrasing);
check('a rephrasing does not pay again', rephrased.paid === 0, `$${rephrased.paid.toFixed(4)}`);

const followUp = await turn(scenario.followUp);
check('a follow-up is made to stand alone', followUp.question !== scenario.followUp, followUp.question);

const disputed = await turn(scenario.falseClaim);
check('a dispute re-reads the code', disputed.answer.source === 'corrected', disputed.answer.source);
check('the dispute did not duplicate the entry', knowledgeBase.size === seeded + 1, `entries=${knowledgeBase.size}`);
check(
  'a false claim is not adopted',
  !disputed.answer.shortAnswer.toLowerCase().includes(scenario.falseClaimMarker.toLowerCase()),
  scenario.falseClaimMarker,
);

// Generic on purpose: any second objection exercises the cooldown, and it
// does not have to mean anything about the codebase under test.
const again = await turn('no, that is wrong too');
check('a repeat dispute does not pay again', again.paid === 0, `$${again.paid.toFixed(4)}`);
check(
  'and it does not claim the code has changed',
  !/out of date/.test(formatAnswer(again.answer)),
  formatAnswer(again.answer).split('\n')[0],
);

// Move the code the answer came from.
const stored = knowledgeBase.byFile(cold.entryFile!)!;
const moved = stored.derivedFrom[0]!;
appendFileSync(join(code, moved), '\n// the code behind this answer has moved\n');
check('staleness is detectable', sources.fingerprint(stored.derivedFrom) !== stored.fingerprint, moved);

const refreshed = await turn(QUESTION);
check('moved code triggers a paid refresh', refreshed.paid > 0, `$${refreshed.paid.toFixed(4)}`);
check('the refresh did not duplicate the entry', knowledgeBase.size === seeded + 1, `entries=${knowledgeBase.size}`);

const settled = await turn(QUESTION);
check('after refreshing it is free again', settled.paid === 0 && settled.answer.source === 'knowledge-base');

// The other direction: a pre-existing entry must still be reachable. A fix for
// answering too eagerly is easy to overshoot into never answering at all.
if (seeded > 0 && scenario.alreadyCovered) {
  const stored = await turn(scenario.alreadyCovered);
  check('a question the stored entries do cover is served for nothing', stored.paid === 0, `$${stored.paid.toFixed(4)}`);
  check('and comes from the knowledge base', stored.answer.source === 'knowledge-base', stored.answer.source);
}

console.log(`\nsession spend: $${core.spentUsd().toFixed(4)} across ${knowledgeBase.size} entries`);
console.log(`workspace kept for inspection: ${workspace}`);
console.log(failures === 0 ? '\nSOAK PASSED' : `\n${failures} SOAK CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
