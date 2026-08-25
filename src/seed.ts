import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  chosenQuestions,
  createClaudeEngine,
  createClaudeJudge,
  createClaudeProposer,
  createKnowledgeBase,
  estimateCostUsd,
  formatSeedPlan,
  parseSeedPlan,
} from './core/index.js';

const PLAN_FILE = process.env.DOCSEARCHER_SEED_PLAN ?? 'seed-plan.md';
const KNOWLEDGE_BASE =
  process.env.DOCSEARCHER_KNOWLEDGE_BASE ?? join(import.meta.dirname, '..', 'knowledge-base');
const CODEBASE = process.env.DOCSEARCHER_CODEBASE;
const MODEL = process.env.DOCSEARCHER_MODEL ?? 'claude-opus-5';
const LIMIT = Number(process.env.DOCSEARCHER_SEED_AREAS) || 8;

if (!CODEBASE) {
  console.error('Set DOCSEARCHER_CODEBASE to the codebase this install answers about.');
  process.exit(2);
}

// --dry-run reads the plan and reports, so it implies --write's half of the job
// without the part that costs anything.
const dryRun = process.argv.includes('--dry-run');
const write = dryRun || process.argv.includes('--write');
await (write ? writeChosen() : propose());

/** Phase one: read the codebase and put a checklist in front of a developer. */
async function propose(): Promise<void> {
  if (existsSync(PLAN_FILE)) {
    console.error(
      `${PLAN_FILE} already exists. Delete it to propose again, or run with --write to act on it.`,
    );
    process.exit(2);
  }

  console.log(`Reading ${CODEBASE} to propose up to ${LIMIT} areas. This takes a minute.`);
  const areas = await createClaudeProposer({ codebase: CODEBASE!, model: MODEL }).propose(LIMIT);

  if (areas.length === 0) {
    console.error('Nothing was proposed. Nothing has been written.');
    process.exit(1);
  }

  writeFileSync(PLAN_FILE, formatSeedPlan(areas), 'utf8');
  const questions = areas.reduce((total, area) => total + area.questions.length, 0);
  console.log(`\nProposed ${areas.length} areas covering ${questions} questions -> ${PLAN_FILE}`);
  console.log('Nothing has been written to the knowledge base yet.');
  console.log(`Tick what you want, then: npm run seed -- --write`);
}

/** Phase two: document only what a developer ticked. */
async function writeChosen(): Promise<void> {
  if (!existsSync(PLAN_FILE)) {
    console.error(`No ${PLAN_FILE}. Run \`npm run seed\` first to propose one.`);
    process.exit(2);
  }

  const areas = parseSeedPlan(readFileSync(PLAN_FILE, 'utf8'));
  const questions = chosenQuestions(areas);

  if (questions.length === 0) {
    console.error(`Nothing is ticked in ${PLAN_FILE}. Nothing has been written.`);
    process.exit(1);
  }

  const knowledgeBase = createKnowledgeBase(KNOWLEDGE_BASE);

  // Only an exact repeat is free to spot. A question the knowledge base answers
  // in different words needs the same second opinion everything else does, so
  // the estimate below counts anything not word-for-word identical as
  // outstanding -- it is an upper bound, and the run itself checks properly.
  const outstanding = questions.filter((question) => !knowledgeBase.find(question));
  const { low, high } = estimateCostUsd(outstanding.length);

  const plural = questions.length === 1 ? 'question' : 'questions';
  console.log(`${questions.length} ${plural} ticked; ${outstanding.length} not yet covered.`);
  console.log(`Answering those would take about a minute each and cost roughly $${low.toFixed(2)}-$${high.toFixed(2)}.\n`);

  if (dryRun) {
    for (const question of questions) {
      console.log(`${knowledgeBase.find(question) ? 'covered ' : 'would ask'}  ${question}`);
    }
    console.log('\nNothing was written. Drop --dry-run to answer the ones that are not covered.');
    return;
  }

  const engine = createClaudeEngine({ codebase: CODEBASE!, model: MODEL, maxBudgetUsd: 5 });
  const judge = createClaudeJudge({
    model: process.env.DOCSEARCHER_JUDGE_MODEL ?? MODEL,
    cwd: CODEBASE!,
  });
  let written = 0;
  let spent = 0;

  for (const [index, question] of questions.entries()) {
    const position = `[${index + 1}/${questions.length}]`;

    // Seeding twice, or seeding something an asker already triggered, should not
    // be paid for twice. An exact repeat is free to spot; anything else costs a
    // second opinion, which is cents against the dollar a derivation costs.
    const covered =
      knowledgeBase.find(question) ??
      (await judge.choose(question, knowledgeBase.candidates(question)));
    if (covered) {
      console.log(`${position} already covered by ${covered.file}, skipping: ${question}`);
      continue;
    }

    const attempt = await engine.deriveAnswer(question);
    // Counted whether or not it produced an answer: reading the codebase and
    // finding nothing costs the same as reading it and finding something.
    spent += attempt.costUsd;

    if (!attempt.derivation) {
      console.log(`${position} no answer in the code ($${attempt.costUsd.toFixed(2)}): ${question}`);
      continue;
    }

    const entry = knowledgeBase.add({ ...attempt.derivation, question });
    written += 1;
    console.log(`${position} ${entry.file} ($${attempt.costUsd.toFixed(2)})`);
  }

  console.log(`\nWrote ${written} of ${questions.length} for $${spent.toFixed(2)}. Review the diff before committing.`);
}
