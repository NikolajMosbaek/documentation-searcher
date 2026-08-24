import { missAnswer, type Answer } from './answer.js';
import type { KnowledgeBase } from './knowledgeBase.js';
import type { AnalysisEngine } from './engine.js';
import type { ThreadContext } from './threadContext.js';

export { formatAnswer, findCodeReferences } from './answer.js';
export type { Answer } from './answer.js';
export {
  createKnowledgeBase,
  loadKnowledgeBase,
  parseEntry,
  serializeEntry,
  slugify,
} from './knowledgeBase.js';
export type { Entry, KnowledgeBase } from './knowledgeBase.js';
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
export function createCore(knowledgeBase: KnowledgeBase, engine: AnalysisEngine): Core {
  return {
    async ask(question: string, thread: ThreadContext): Promise<Answer> {
      void thread; // Carried through now; used once follow-ups resolve against it.

      const known = knowledgeBase.find(question);
      if (known) return known.answer;

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
