import { join } from 'node:path';
import { App } from '@microsoft/teams.apps';
import {
  createCore,
  formatAnswer,
  InMemoryThreadStore,
  loadKnowledgeBase,
  unavailableEngine,
} from './core/index.js';

const KNOWLEDGE_BASE = join(import.meta.dirname, '..', 'knowledge-base');

const entries = loadKnowledgeBase(KNOWLEDGE_BASE);
console.log(`[INFO] loaded ${entries.length} knowledge-base entries`);

const core = createCore(entries, unavailableEngine);
const threads = new InMemoryThreadStore();

// The Microsoft 365 Agents Playground sends unauthenticated requests, which the
// SDK rejects by default. Never enable this outside local development.
const isLocalDevelopment = process.env.NODE_ENV !== 'production';
const app = new App({ dangerouslyAllowUnauthenticatedRequests: isLocalDevelopment });

// The entire Teams adapter. It resolves a thread id, hands the question to the
// core, and sends back what the core rendered -- it decides nothing about the answer.
app.on('message', async ({ activity, send }) => {
  await send({ type: 'typing' });

  const threadId = activity.conversation.id;
  const question = activity.text?.trim() ?? '';

  const answer = await core.ask(question, threads.get(threadId));
  threads.record(threadId, { question, answeredFrom: answer.source });

  await send(formatAnswer(answer));
});

const port = Number(process.env.PORT) || 3978;
app.start(port).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
