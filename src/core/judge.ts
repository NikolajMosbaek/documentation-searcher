import type { Entry } from './knowledgeBase.js';

/**
 * A second opinion on entries that lexical retrieval could not decide about.
 *
 * The gap this fills is measurable: a question saying "cancelling halfway
 * through the month" shares one common word with an entry saying "mid-period",
 * so no amount of word counting reaches it. Deriving the answer again costs
 * about a dollar; asking whether an entry already answers it costs cents.
 */
export interface CandidateJudge {
  /** Which of these answers the question, if any. */
  choose(question: string, candidates: Entry[]): Promise<Entry | undefined>;
}

/** Stands in when no judge is configured. Never rescues a near miss. */
export const noJudge: CandidateJudge = {
  async choose(): Promise<Entry | undefined> {
    return undefined;
  },
};
