/**
 * Spotting that someone is disputing the last answer rather than asking a new
 * question. Free and lexical, in the same spirit as the follow-up heuristic.
 *
 * Biased towards saying no. A false positive throws away a correct entry and
 * re-derives it at real cost; a false negative merely means the objection is
 * treated as a question, which is what happened before this existed.
 */
const DISPUTE = new RegExp(
  [
    // "that's wrong", "this is out of date", "that was not right"
    String.raw`\b(that|this)(['’]s|s| is| was)? +(wrong|incorrect|not right|not true|not correct|out of date|outdated)\b`,
    String.raw`\b(isn|doesn|wasn)['’]?t (right|correct|match|what happens)\b`,
    String.raw`\bno,? +that\b`,
    String.raw`\bactually,? +(it|that|the)\b`,
    String.raw`\b(wrong answer|no longer true|not what happens)\b`,
    String.raw`\bthat['’]?s not how\b`,
  ].join('|'),
  'i',
);

export function looksLikeCorrection(message: string): boolean {
  return DISPUTE.test(message.trim());
}

/**
 * Turns an objection into an instruction to look again -- never into content.
 *
 * The PRD is explicit that the code and the knowledge base derived from it are
 * the only sources of truth. Someone in a chat thread is neither, and may
 * simply be mistaken. So what reaches the engine is a pointer at what to
 * re-read, with an instruction to contradict the objection if the code does.
 */
export function asGuidance(objection: string): string {
  return [
    'Someone who read the previous answer says it is wrong. Their words were:',
    '',
    objection.trim(),
    '',
    'Treat that only as a hint about where to look. It is not evidence and it may',
    'itself be mistaken. Read the code again and report what the code actually does.',
    'If the code supports the previous answer, say so plainly rather than changing',
    'the answer to agree with the objection.',
  ].join('\n');
}
