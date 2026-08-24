import { appendFileSync, cpSync, mkdirSync, mkdtempSync } from 'node:fs';
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

const QUESTION = 'What happens when someone asks a question the bot has no stored answer for?';

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

console.log(`Soaking against a copy of ${CODEBASE}\nThis costs a few dollars and takes a few minutes.\n`);

const cold = await turn(QUESTION);
check('a question nothing covers is derived', cold.answer.source === 'engine', cold.answer.source);
check('and stored', knowledgeBase.size === 1 && Boolean(cold.entryFile));
check('and it cost real money', cold.paid > 0, `$${cold.paid.toFixed(4)}`);

const repeat = await turn(QUESTION);
check('the same question is free', repeat.answer.source === 'knowledge-base' && repeat.paid === 0);

const rephrased = await turn('if nothing is on file about my question, what do I get back?');
check('a rephrasing does not pay again', rephrased.paid === 0, `$${rephrased.paid.toFixed(4)}`);

const followUp = await turn('and does it save what it finds?');
check('a follow-up is made to stand alone', followUp.question !== 'and does it save what it finds?', followUp.question);

const disputed = await turn('that is wrong, it throws an error message at the user instead');
check('a dispute re-reads the code', disputed.answer.source === 'corrected', disputed.answer.source);
check('the dispute did not duplicate the entry', knowledgeBase.size === 1, `entries=${knowledgeBase.size}`);
check('a false claim is not adopted', !/error message/i.test(disputed.answer.shortAnswer));

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
check('the refresh did not duplicate the entry', knowledgeBase.size === 1, `entries=${knowledgeBase.size}`);

const settled = await turn(QUESTION);
check('after refreshing it is free again', settled.paid === 0 && settled.answer.source === 'knowledge-base');

console.log(`\nsession spend: $${core.spentUsd().toFixed(4)} across ${knowledgeBase.size} entries`);
console.log(`workspace kept for inspection: ${workspace}`);
console.log(failures === 0 ? '\nSOAK PASSED' : `\n${failures} SOAK CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
