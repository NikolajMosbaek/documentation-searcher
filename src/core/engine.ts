import type { Answer } from './answer.js';

/**
 * The codebase-analysis engine. The constitution fixes the Claude Agent SDK as
 * the implementation, but nothing here knows that -- so no call site does either.
 */
export interface AnalysisEngine {
  /** Derive an answer from the codebase, or null if it cannot. */
  deriveAnswer(question: string): Promise<Answer | null>;
}

/** The stub standing in until the real engine lands. Always misses. */
export const unavailableEngine: AnalysisEngine = {
  async deriveAnswer(): Promise<Answer | null> {
    return null;
  },
};
