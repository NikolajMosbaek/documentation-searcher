import { missAnswer, type Answer } from './answer.js';
import { findEntry, type Entry } from './knowledgeBase.js';
import type { AnalysisEngine } from './engine.js';
import type { ThreadContext } from './threadContext.js';

export { formatAnswer } from './answer.js';
export type { Answer } from './answer.js';
export { loadKnowledgeBase } from './knowledgeBase.js';
export { unavailableEngine } from './engine.js';
export { InMemoryThreadStore } from './threadContext.js';
export type { ThreadContext, Turn } from './threadContext.js';

export interface Core {
  ask(question: string, thread: ThreadContext): Promise<Answer>;
}

/**
 * The product. Transport-agnostic by design: it knows nothing about Teams, and
 * a second front end would call exactly this.
 */
export function createCore(entries: Entry[], engine: AnalysisEngine): Core {
  return {
    async ask(question: string, thread: ThreadContext): Promise<Answer> {
      void thread; // Carried through now; used once follow-ups resolve against it.

      const known = findEntry(entries, question);
      if (known) return known.answer;

      return (await engine.deriveAnswer(question)) ?? missAnswer();
    },
  };
}
