/**
 * The shape of every answer this product gives, and the only place that shape
 * is decided. Per the constitution, no transport adapter may render or restructure
 * an answer itself -- adapters call `formatAnswer` and send the result verbatim.
 */
export interface Answer {
  /** A direct answer in one or two sentences. */
  shortAnswer: string;
  /** The behaviour, broken into ordered steps. */
  behaviour: string[];
  /** Conditions and exceptions that change the behaviour. */
  edgeCases: string[];
  /** Where this answer came from. Diagnostic only -- never shown to the asker. */
  source: 'knowledge-base' | 'engine' | 'miss';
}

export function formatAnswer(answer: Answer): string {
  const lines: string[] = ['**Short answer**', answer.shortAnswer];

  if (answer.behaviour.length > 0) {
    lines.push('', '**What happens**');
    answer.behaviour.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }

  if (answer.edgeCases.length > 0) {
    lines.push('', '**Edge cases**');
    answer.edgeCases.forEach((edgeCase) => lines.push(`- ${edgeCase}`));
  }

  return lines.join('\n');
}

/**
 * An honest miss. The PRD's real behaviour here is to search the codebase and
 * write a new entry; until the analysis engine exists, saying so plainly beats
 * inventing an answer.
 */
export function missAnswer(): Answer {
  return {
    shortAnswer:
      "I don't have an answer to that yet, and I won't guess at one. Nothing in what I know covers it.",
    behaviour: [],
    edgeCases: [],
    source: 'miss',
  };
}

/**
 * The PRD forbids file paths, function names, and code snippets in answers.
 * This catches the obvious cases so a hand-written entry that leaks code detail
 * gets flagged at load time rather than reaching an asker.
 */
const CODE_SHAPED = [
  // A filename, which also catches a line reference like "subscription.ts:142"
  // because the extension ends at the colon.
  /\b[\w/-]+\.(ts|tsx|js|py|cs|java|rb|go|rs|php)\b/i,
  /\b\w+\.\w+\(\)/,
  /`[^`]+`/,
];

export function findCodeReferences(answer: Answer): string[] {
  const text = [answer.shortAnswer, ...answer.behaviour, ...answer.edgeCases];
  return text.filter((line) => CODE_SHAPED.some((pattern) => pattern.test(line)));
}
