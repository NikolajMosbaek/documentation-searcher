import { missAnswer, recheckFailedAnswer, type Answer } from './answer.js';
import type { Entry, KnowledgeBase } from './knowledgeBase.js';
import type { SourceIndex } from './sourceIndex.js';
import { looksDependent, noFollowUpResolver, type FollowUpResolver } from './followUp.js';
import { asGuidance, looksLikeCorrection } from './correction.js';
import type { AnalysisEngine } from './engine.js';
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

export interface Core {
  ask(question: string, thread: ThreadContext): Promise<Exchange>;
}

/**
 * The product. Transport-agnostic by design: it knows nothing about Teams, and
 * a second front end would call exactly this.
 */
export function createCore(
  knowledgeBase: KnowledgeBase,
  engine: AnalysisEngine,
  sources?: SourceIndex,
  resolver: FollowUpResolver = noFollowUpResolver,
): Core {
  return {
    async ask(asked: string, thread: ThreadContext): Promise<Exchange> {
      // A dispute is not a new question -- it acts on the answer just given.
      const previous = thread.turns[thread.turns.length - 1];
      if (previous && looksLikeCorrection(asked)) {
        return dispute(asked, previous);
      }

      // The first question in a thread has nothing to lean on, so it is never
      // rewritten -- and neither is one that reads as self-contained. Both
      // checks are free; only what survives them costs a call.
      const question =
        thread.turns.length > 0 && looksDependent(asked)
          ? await resolver.resolve(asked, thread)
          : asked;

      const known = knowledgeBase.find(question);
      if (known) {
        if (!isStale(known, sources)) {
          return { answer: known.answer, question, entryFile: known.file };
        }

        // Verify on read: the code moved, so the stored answer is not trusted
        // until it has been derived again from what the code says now.
        const refreshed = await engine.deriveAnswer(question);
        if (refreshed) {
          try {
            // Keep the question the entry was created under. A refresh may have
            // been triggered by a different phrasing that retrieval matched, and
            // overwriting would revoke the original asker's guarantee.
            knowledgeBase.replace(known, { ...refreshed, question: known.question || question });
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
   * Act on someone flagging the previous answer as wrong.
   *
   * The objection never becomes an answer. It is handed to the engine as a
   * pointer at what to re-read, and whatever the code says wins -- including
   * when the code says the original answer was right all along.
   */
  async function dispute(objection: string, previous: Turn): Promise<Exchange> {
    const question = previous.resolved;
    const existing = previous.entryFile ? knowledgeBase.byFile(previous.entryFile) : undefined;

    const rederived = await engine.deriveAnswer(question, asGuidance(objection));
    if (!rederived) {
      return { answer: recheckFailedAnswer(), question, entryFile: previous.entryFile };
    }

    let entryFile = previous.entryFile;
    try {
      entryFile = existing
        ? knowledgeBase.replace(existing, { ...rederived, question: existing.question || question }).file
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
