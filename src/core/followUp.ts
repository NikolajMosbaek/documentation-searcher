import { tokenize } from './retrieval.js';
import type { ThreadContext } from './threadContext.js';

/**
 * Turns a question that leans on the conversation into one that stands on its
 * own. Everything downstream -- retrieval, derivation, and the entry that gets
 * written -- then works on a question that means something by itself.
 *
 * That last part is why this matters more than it looks. Since the bot began
 * writing entries, an unresolved follow-up does not merely get answered badly:
 * it gets *stored*, under a title and keywords that make no sense to anyone
 * who was not in the thread.
 */
export interface FollowUpResolver {
  resolve(question: string, thread: ThreadContext): Promise<string>;
}

/** Stands in when no resolver is configured. Every question stands alone. */
export const noFollowUpResolver: FollowUpResolver = {
  async resolve(question: string): Promise<string> {
    return question;
  },
};

/**
 * Openers that hand the sentence's subject back to the previous turn.
 */
const DEPENDENT_OPENER =
  /^(and|or|but|so|then|also|what about|how about|why|does it|do they|is it|are they|can it|can they|what if|and if|and what|ok|okay)\b/i;

/** Words that point at something the sentence never names. */
const REFERENT = /\b(it|its|they|them|their|that|this|those|these|he|she|him|her|there|same)\b/i;

/**
 * A free guess at whether a question needs the conversation to make sense.
 *
 * Deliberately biased towards saying yes. A false positive costs one cheap
 * rewrite that returns the question unchanged; a false negative costs a
 * derivation of a question nobody can read, and a bad entry to go with it.
 *
 * It is a heuristic standing in for understanding, and it stays one until a
 * fake genuinely cannot cut it.
 */
export function looksDependent(question: string): boolean {
  const trimmed = question.trim();
  if (!trimmed) return false;

  return (
    DEPENDENT_OPENER.test(trimmed) || REFERENT.test(trimmed) || tokenize(trimmed).length <= 2
  );
}
