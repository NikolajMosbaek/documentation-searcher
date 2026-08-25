import { join } from 'node:path';
import { App } from '@microsoft/teams.apps';
import {
  createClaudeEngine,
  createClaudeJudge,
  createClaudeResolver,
  createCore,
  createKnowledgeBase,
  createSourceIndex,
  formatAnswer,
  InMemoryThreadStore,
  noFollowUpResolver,
  noJudge,
  unavailableEngine,
} from './core/index.js';

const KNOWLEDGE_BASE =
  process.env.DOCSEARCHER_KNOWLEDGE_BASE ?? join(import.meta.dirname, '..', 'knowledge-base');

// One install serves exactly one codebase, per the PRD -- so this is a single
// path read once at startup, not something an asker can choose per question.
const CODEBASE = process.env.DOCSEARCHER_CODEBASE;

const knowledgeBase = createKnowledgeBase(KNOWLEDGE_BASE);
console.log(`[INFO] loaded ${knowledgeBase.size} knowledge-base entries`);

const engine = CODEBASE
  ? createClaudeEngine({
      codebase: CODEBASE,
      model: process.env.DOCSEARCHER_MODEL ?? 'claude-opus-5',
      // Deriving one answer from a real codebase was measured at about a
      // dollar, so a ceiling of one dollar cuts off genuine questions.
      maxBudgetUsd: Number(process.env.DOCSEARCHER_MAX_USD) || 5,
    })
  : unavailableEngine;

console.log(
  CODEBASE
    ? `[INFO] a miss will be answered by reading ${CODEBASE}`
    : '[INFO] no codebase configured: set DOCSEARCHER_CODEBASE to fill misses',
);

// Without a codebase there is nothing to compare an entry against, so stored
// answers are served as written rather than guessed about.
const sources = CODEBASE ? createSourceIndex(CODEBASE) : undefined;

// Rewriting a follow-up needs a model but no codebase, so it is available
// wherever the engine is.
const resolver = CODEBASE
  ? createClaudeResolver({
      model: process.env.DOCSEARCHER_RESOLVER_MODEL ?? process.env.DOCSEARCHER_MODEL ?? 'claude-opus-5',
      cwd: CODEBASE,
    })
  : noFollowUpResolver;

// Weighing a near miss needs a model but no codebase, like the resolver.
const judge = CODEBASE
  ? createClaudeJudge({
      model: process.env.DOCSEARCHER_JUDGE_MODEL ?? process.env.DOCSEARCHER_MODEL ?? 'claude-opus-5',
      cwd: CODEBASE,
    })
  : noJudge;

const core = createCore(knowledgeBase, engine, { sources, resolver, judge });
const threads = new InMemoryThreadStore();

// The Microsoft 365 Agents Playground sends unauthenticated requests, which the
// SDK rejects by default.
//
// This used to be inferred from NODE_ENV not being 'production', which fails
// open: anything deployed without that variable set accepted unauthenticated
// requests on the endpoint that answers questions about a private codebase.
// Iteration 1 flagged it and iteration 2 restated it, and it survived because
// inferring it costs nobody anything until it costs everything. Turning on an
// option named "dangerously" now requires saying so.
const allowUnauthenticated = process.env.DOCSEARCHER_ALLOW_UNAUTHENTICATED === 'true';
if (allowUnauthenticated) {
  console.warn(
    '[WARN] accepting unauthenticated requests because DOCSEARCHER_ALLOW_UNAUTHENTICATED is set. Local development only.',
  );
}
const app = new App({ dangerouslyAllowUnauthenticatedRequests: allowUnauthenticated });

// The entire Teams adapter. It resolves a thread id, hands the question to the
// core, and sends back what the core rendered -- it decides nothing about the answer.
app.on('message', async ({ activity, send }) => {
  await send({ type: 'typing' });

  const threadId = activity.conversation.id;
  const question = activity.text?.trim() ?? '';

  const exchange = await core.ask(question, threads.get(threadId));
  threads.record(threadId, {
    question,
    resolved: exchange.question,
    answeredFrom: exchange.answer.source,
    entryFile: exchange.entryFile,
  });

  await send(formatAnswer(exchange.answer));
});

const port = Number(process.env.PORT) || 3978;
app.start(port).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
