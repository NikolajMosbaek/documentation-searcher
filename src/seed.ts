import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  chosenQuestions,
  createClaudeEngine,
  createClaudeProposer,
  createKnowledgeBase,
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

const write = process.argv.includes('--write');
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
  const engine = createClaudeEngine({ codebase: CODEBASE!, model: MODEL, maxBudgetUsd: 5 });

  const plural = questions.length === 1 ? 'question' : 'questions';
  console.log(`${questions.length} ${plural} to answer. Roughly a minute and a dollar each.\n`);
  let written = 0;

  for (const [index, question] of questions.entries()) {
    const position = `[${index + 1}/${questions.length}]`;

    // Seeding twice, or seeding something an asker already triggered, should
    // not be paid for twice.
    if (knowledgeBase.find(question)) {
      console.log(`${position} already covered, skipping: ${question}`);
      continue;
    }

    const derived = await engine.deriveAnswer(question);
    if (!derived) {
      console.log(`${position} no answer in the code: ${question}`);
      continue;
    }

    const entry = knowledgeBase.add({ ...derived, question });
    written += 1;
    console.log(`${position} ${entry.file}`);
  }

  console.log(`\nWrote ${written} of ${questions.length}. Review the diff before committing.`);
}
