import type { Answer } from './answer.js';

/**
 * What the analysis engine produces when it manages to answer: the answer
 * itself, plus everything needed to store it as a knowledge-base entry.
 *
 * The engine is the only thing that knows which code it read, so it is the only
 * thing that can record it -- hence `derivedFrom` living here rather than being
 * reconstructed later.
 */
export interface Derivation {
  answer: Answer;
  /**
   * The question this was derived for. Stored so that the exact question which
   * paid for an entry is guaranteed to find it again -- keyword matching alone
   * does not guarantee that, because the keywords are the model's words and the
   * question is the asker's.
   */
  question: string;
  /** Title for the stored entry, in the asker's language rather than the code's. */
  title: string;
  /** Lookup keywords for the stored entry. */
  keywords: string[];
  /**
   * The parts of the codebase this answer came from. Metadata only: it is the
   * one place a file path is allowed, it is never rendered into an answer, and
   * it is never shown to an asker. The staleness check reads it.
   */
  derivedFrom: string[];
  /**
   * What those files hashed to at the moment this answer was derived. Recomputed
   * on every read to decide whether the answer still describes the code.
   */
  fingerprint: string;
  /**
   * What deriving this actually cost, as the engine reports it. Optional
   * because a stub engine spends nothing and should not have to pretend.
   */
  costUsd?: number;
}

/**
 * The codebase-analysis engine. The constitution fixes the Claude Agent SDK as
 * the implementation, but nothing here knows that -- so no call site does either.
 */
export interface AnalysisEngine {
  /**
   * Derive an answer from the codebase, or null if it cannot.
   *
   * `guidance` points the engine at something worth re-reading -- currently a
   * disputed answer. It is never content to be repeated back: the codebase
   * remains the only thing an answer may be derived from.
   */
  deriveAnswer(question: string, guidance?: string): Promise<Derivation | null>;
}

/**
 * Stands in when no codebase is configured. Always misses, which makes the
 * product degrade to "honest about not knowing" rather than to broken.
 */
export const unavailableEngine: AnalysisEngine = {
  async deriveAnswer(): Promise<Derivation | null> {
    return null;
  },
};
