/**
 * The questions retrieval and the judge are measured against, and the entries
 * that count as answering them.
 *
 * Shared so that the hermetic evaluation (`retrievalEvaluation.test.ts`, which
 * measures retrieval alone and costs nothing) and the live one
 * (`npm run judge-eval`, which asks a real model) are judged against exactly
 * the same labels. Two copies would drift, and the whole point is comparing
 * what retrieval decides with what the judge decides about the same question.
 *
 * The labels are a human judgement about which entry answers which question.
 * If one is wrong, both evaluations enforce the wrong thing.
 */
export const NO_ANSWER = [
  'answering-a-question-nothing-stored-covers.md',
  'what-happens-when-no-stored-answer-covers-a-question.md',
];

/** A third pair the engine produced for the same behaviour, on a later run. */
export const FLAGGING = [
  'flagging-an-answer-as-wrong-in-the-conversation.md',
  'telling-the-bot-an-answer-is-wrong.md',
];

/**
 * Three entries about the same behaviour, not two. The third arrived when the
 * corpus was grown, and a judge picked it over both older ones for "how does it
 * know an answer went stale?" -- correctly: its own stored question is "how does
 * the bot know when the code behind an answer has changed?". The label was
 * stale, not the judge.
 */
export const STALE = [
  'refreshing-a-stored-answer-when-the-code-behind-it-has-chang.md',
  'what-happens-when-a-stored-answer-is-out-of-date.md',
  'noticing-when-the-code-behind-a-stored-answer-has-changed.md',
];

/** Rephrasings: none repeats the wording of the entry that should answer it. */
export const REPHRASINGS: Array<[question: string, acceptable: string[]]> = [
  ['if the bot has never seen my question before, what does it do?', NO_ANSWER],
  ['is anything written down when it works out a new answer?', NO_ANSWER],
  ['can the bot edit my files?', ['the-assistant-only-reads-the-codebase-never-changes-it.md']],
  ['how does it know an answer went stale?', STALE],
  ['what if the analysis service is down?', ['what-the-bot-does-when-the-code-reading-service-is-unreachab.md']],
  ['how do I report a bad reply?', FLAGGING],
  ['what happens if nobody points it at any source code?', ['behaviour-when-no-codebase-is-configured.md']],
  ['am I charged when my free period finishes?', ['trial-expiry.md']],
  ['if I stop my subscription mid-cycle do I keep access?', ['cancel-subscription-mid-period.md']],
  ['how many times is a declined card retried?', ['failed-payment-retry.md']],
];

/** Questions this knowledge base has no business answering. */
export const UNRELATED = [
  'what colour is the office carpet?',
  'who is the chief executive?',
  'can I export my data to a spreadsheet?',
  'how do I change my billing address?',
  'what is the office wifi password?',
  'does the bot support Slack as well?',
  'how many people work here?',
];

export const CORPUS_DIRECTORY = 'src/core/fixtures/corpus';
