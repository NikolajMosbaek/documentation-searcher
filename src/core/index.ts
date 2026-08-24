import { missAnswer, recentlyRecheckedAnswer, recheckFailedAnswer, type Answer } from './answer.js';
import type { Entry, KnowledgeBase } from './knowledgeBase.js';
import type { SourceIndex } from './sourceIndex.js';
import { looksDependent, noFollowUpResolver, type FollowUpResolver } from './followUp.js';
import { noJudge, type CandidateJudge } from './judge.js';
import { asGuidance, looksLikeCorrection } from './correction.js';
import type { AnalysisEngine, Derivation } from './engine.js';
import type { ThreadContext, Turn } from './threadContext.js';

export { formatAnswer, findCodeReferences } from './answer.js';
export type { Answer } from './answer.js';
export {
  createKnowledgeBase,
  loadKnowledgeBase,
  normalizeQuestion,
  parseEntry,
  serializeEntry,
  slugify,
} from './knowledgeBase.js';
export type { Entry, KnowledgeBase } from './knowledgeBase.js';
export { asGuidance, looksLikeCorrection } from './correction.js';
export { noJudge } from './judge.js';
export type { CandidateJudge } from './judge.js';
export { createClaudeJudge } from './claudeJudge.js';
export type { ClaudeJudgeConfig } from './claudeJudge.js';
export { chosenQuestions, estimateCostUsd, formatSeedPlan, parseSeedPlan } from './seeding.js';
export type { Area, AreaProposer } from './seeding.js';
export { createClaudeProposer } from './claudeProposer.js';
export type { ClaudeProposerConfig } from './claudeProposer.js';
export { looksDependent, noFollowUpResolver } from './followUp.js';
export type { FollowUpResolver } from './followUp.js';
export { createClaudeResolver } from './claudeResolver.js';
export type { ClaudeResolverConfig } from './claudeResolver.js';
export { createRetrievalIndex, tokenize } from './retrieval.js';
export type { Match, RetrievalIndex } from './retrieval.js';
export { createSourceIndex } from './sourceIndex.js';
export type { SourceIndex } from './sourceIndex.js';
export { unavailableEngine } from './engine.js';
export type { AnalysisEngine, Derivation } from './engine.js';
export { createClaudeEngine } from './claudeEngine.js';
export type { ClaudeEngineConfig } from './claudeEngine.js';
export { InMemoryThreadStore } from './threadContext.js';
export type { ThreadContext, Turn } from './threadContext.js';

/**
 * The result of one turn. The constitution sketches the core as
 * `ask(question, threadContext) -> answer`; this returns the resolved question
 * alongside it, because a caller that records the conversation needs to know
 * what the question was taken to mean, not just what was typed.
 */
export interface Exchange {
  answer: Answer;
  /** The self-contained form of the question. Equal to what was asked unless it was a follow-up. */
  question: string;
  /** Which stored entry answered, when one did. Recorded so a dispute can act on it. */
  entryFile?: string;
}

/** Why the codebase was read. Every one of these costs about a dollar. */
export type SpendReason = 'miss' | 'refresh' | 'dispute';

/** What one conversation has cost, and how many reads of the codebase it took. */
export interface ThreadSpend {
  threadId: string;
  costUsd: number;
  reads: number;
}

export interface Core {
  ask(question: string, thread: ThreadContext): Promise<Exchange>;
  /** What this process has spent reading the codebase, as the engine reported it. */
  spentUsd(): number;
  /**
   * The same total, broken down by conversation, most expensive first.
   * "What is this costing" is answerable without it; "who is it costing it on"
   * is not, and that is the question an operator actually asks.
   */
  spendByThread(): ThreadSpend[];
}

/**
 * The product. Transport-agnostic by design: it knows nothing about Teams, and
 * a second front end would call exactly this.
 */
/**
 * Everything the core can be given beyond the two things it cannot work
 * without. All optional, and each one absent means that behaviour is simply
 * not available rather than broken.
 */
export interface CoreOptions {
  /** Without it, no stored answer can be checked for staleness. */
  sources?: SourceIndex;
  /** Without it, a follow-up is taken literally. */
  resolver?: FollowUpResolver;
  /** Without it, a near miss is derived from scratch rather than reconsidered. */
  judge?: CandidateJudge;
  /**
   * How long an entry is left alone after being re-read for a dispute. Nothing
   * stops one person flagging the same answer repeatedly, and each flag reads
   * the whole codebase again.
   */
  disputeCooldownMs?: number;
}

export function createCore(
  knowledgeBase: KnowledgeBase,
  engine: AnalysisEngine,
  options: CoreOptions = {},
): Core {
  const {
    sources,
    resolver = noFollowUpResolver,
    judge = noJudge,
    disputeCooldownMs = 5 * 60 * 1000,
  } = options;

  let spentUsd = 0;
  const perThread = new Map<string, ThreadSpend>();
  const lastDisputed = new Map<string, number>();

  /**
   * The whole product turns on a question costing about a dollar the first time
   * and nothing afterwards. Leaving that invisible makes the one number worth
   * watching the one number nobody can see.
   */
  function recordSpend(
    reason: SpendReason,
    derivation: Derivation,
    question: string,
    threadId: string,
  ): void {
    const cost = derivation.costUsd ?? 0;
    spentUsd += cost;

    const thread = perThread.get(threadId) ?? { threadId, costUsd: 0, reads: 0 };
    thread.costUsd += cost;
    thread.reads += 1;
    perThread.set(threadId, thread);

    console.log(
      `[SPEND] $${cost.toFixed(4)} ${reason.padEnd(8)} thread=${threadId} ` +
        `(thread $${thread.costUsd.toFixed(4)}, session $${spentUsd.toFixed(4)}) ${question}`,
    );
  }

  return {
    spentUsd(): number {
      return spentUsd;
    },

    spendByThread(): ThreadSpend[] {
      return [...perThread.values()]
        .map((thread) => ({ ...thread }))
        .sort((a, b) => b.costUsd - a.costUsd);
    },

    async ask(asked: string, thread: ThreadContext): Promise<Exchange> {
      // A dispute is not a new question -- it acts on the answer just given.
      const previous = thread.turns[thread.turns.length - 1];
      if (previous && looksLikeCorrection(asked)) {
        return dispute(asked, previous, thread.threadId);
      }

      // The first question in a thread has nothing to lean on, so it is never
      // rewritten -- and neither is one that reads as self-contained. Both
      // checks are free; only what survives them costs a call.
      const question =
        thread.turns.length > 0 && looksDependent(asked)
          ? await resolver.resolve(asked, thread)
          : asked;

      // Lexical retrieval is deliberately reluctant, so a near miss gets a
      // second opinion before anything is paid for. Cents against a dollar.
      const known = knowledgeBase.find(question) ?? (await reconsider(question));
      if (known) {
        if (!isStale(known, sources)) {
          return { answer: known.answer, question, entryFile: known.file };
        }

        // Verify on read: the code moved, so the stored answer is not trusted
        // until it has been derived again from what the code says now.
        const refreshed = await engine.deriveAnswer(question);
        if (refreshed) {
          recordSpend('refresh', refreshed, question, thread.threadId);
          try {
            knowledgeBase.replace(known, refreshed);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn(`[WARN] refreshed an entry but could not rewrite it: ${reason}`);
          }
          return { answer: refreshed.answer, question, entryFile: known.file };
        }

        // Re-deriving failed. The PRD forbids handing over an answer that is
        // *silently* outdated -- so it is handed over, and it says so.
        console.warn(`[WARN] ${known.file} is out of date and could not be refreshed`);
        return { answer: { ...known.answer, source: 'stale' }, question, entryFile: known.file };
      }

      const derived = await engine.deriveAnswer(question);
      if (!derived) return { answer: missAnswer(), question };

      // Lazy population on miss: storing it is what makes the second asker free.
      // A failure to store is not a failure to answer, so it does not propagate.
      recordSpend('miss', derived, question, thread.threadId);

      let stored: string | undefined;
      try {
        // The core is authoritative about what was asked; the engine only
        // echoes it back, and an echo is a place for drift.
        stored = knowledgeBase.add({ ...derived, question }).file;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[WARN] answered but could not store the new entry: ${reason}`);
      }

      return { answer: derived.answer, question, entryFile: stored };
    },
  };

  /**
   * Ask whether anything already stored answers a question that retrieval was
   * not confident enough to answer with. Skipped entirely when retrieval found
   * nothing at all: there is no shared word to weigh, so there is nothing to ask.
   */
  async function reconsider(question: string): Promise<Entry | undefined> {
    const maybe = knowledgeBase.candidates(question);
    if (maybe.length === 0) return undefined;

    const chosen = await judge.choose(question, maybe);
    if (!chosen) {
      // The cases worth collecting: something looked close, was rejected, and a
      // dollar was then spent on a question the knowledge base may have held.
      console.log(
        `[INFO] weighed ${maybe.length} stored answer(s) and chose none, deriving instead: ${question}`,
      );
    }
    return chosen;
  }

  /**
   * Act on someone flagging the previous answer as wrong.
   *
   * The objection never becomes an answer. It is handed to the engine as a
   * pointer at what to re-read, and whatever the code says wins -- including
   * when the code says the original answer was right all along.
   */
  async function dispute(objection: string, previous: Turn, threadId: string): Promise<Exchange> {
    const question = previous.resolved;
    const existing = previous.entryFile ? knowledgeBase.byFile(previous.entryFile) : undefined;

    if (existing) {
      const lastRead = lastDisputed.get(existing.file);
      if (lastRead !== undefined && Date.now() - lastRead < disputeCooldownMs) {
        console.log(`[INFO] ${existing.file} was re-read moments ago; not reading again`);
        return { answer: recentlyRecheckedAnswer(), question, entryFile: existing.file };
      }
      lastDisputed.set(existing.file, Date.now());
    }

    const rederived = await engine.deriveAnswer(question, asGuidance(objection));
    if (!rederived) {
      return { answer: recheckFailedAnswer(), question, entryFile: previous.entryFile };
    }

    recordSpend('dispute', rederived, question, threadId);

    let entryFile = previous.entryFile;
    try {
      entryFile = existing
        ? knowledgeBase.replace(existing, rederived).file
        : knowledgeBase.add({ ...rederived, question }).file;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[WARN] re-read the code but could not store the correction: ${reason}`);
    }

    return { answer: { ...rederived.answer, source: 'corrected' }, question, entryFile };
  }
}

/**
 * An entry is only checkable if a machine wrote it against a codebase we still
 * have. A hand-written entry carries no fingerprint and is never called stale:
 * a developer wrote it deliberately and owns it.
 */
function isStale(entry: Entry, sources: SourceIndex | undefined): boolean {
  if (!sources || !entry.fingerprint || entry.derivedFrom.length === 0) return false;
  return sources.fingerprint(entry.derivedFrom) !== entry.fingerprint;
}
