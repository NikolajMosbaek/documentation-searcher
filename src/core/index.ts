import { missAnswer, type Answer } from './answer.js';
import type { Entry, KnowledgeBase } from './knowledgeBase.js';
import type { SourceIndex } from './sourceIndex.js';
import type { AnalysisEngine } from './engine.js';
import type { ThreadContext } from './threadContext.js';

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
export { createSourceIndex } from './sourceIndex.js';
export type { SourceIndex } from './sourceIndex.js';
export { unavailableEngine } from './engine.js';
export type { AnalysisEngine, Derivation } from './engine.js';
export { createClaudeEngine } from './claudeEngine.js';
export type { ClaudeEngineConfig } from './claudeEngine.js';
export { InMemoryThreadStore } from './threadContext.js';
export type { ThreadContext, Turn } from './threadContext.js';

export interface Core {
  ask(question: string, thread: ThreadContext): Promise<Answer>;
}

/**
 * The product. Transport-agnostic by design: it knows nothing about Teams, and
 * a second front end would call exactly this.
 */
export function createCore(
  knowledgeBase: KnowledgeBase,
  engine: AnalysisEngine,
  sources?: SourceIndex,
): Core {
  return {
    async ask(question: string, thread: ThreadContext): Promise<Answer> {
      void thread; // Carried through now; used once follow-ups resolve against it.

      const known = knowledgeBase.find(question);
      if (known) {
        if (!isStale(known, sources)) return known.answer;

        // Verify on read: the code moved, so the stored answer is not trusted
        // until it has been derived again from what the code says now.
        const refreshed = await engine.deriveAnswer(question);
        if (refreshed) {
          try {
            knowledgeBase.replace(known, refreshed);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn(`[WARN] refreshed an entry but could not rewrite it: ${reason}`);
          }
          return refreshed.answer;
        }

        // Re-deriving failed. The PRD forbids handing over an answer that is
        // *silently* outdated -- so it is handed over, and it says so.
        console.warn(`[WARN] ${known.file} is out of date and could not be refreshed`);
        return { ...known.answer, source: 'stale' };
      }

      const derived = await engine.deriveAnswer(question);
      if (!derived) return missAnswer();

      // Lazy population on miss: storing it is what makes the second asker free.
      // A failure to store is not a failure to answer, so it does not propagate.
      try {
        knowledgeBase.add(derived);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[WARN] answered but could not store the new entry: ${reason}`);
      }

      return derived.answer;
    },
  };
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
