/**
 * What the soak asks, and what it expects the answers not to contain.
 *
 * The soak is only useful as an installation check if it can be pointed at the
 * codebase someone actually runs this against. Its questions were about this
 * bot specifically, which made it a check on this repository rather than on
 * the product.
 */
export interface SoakScenario {
  /** A question the codebase can answer and the knowledge base does not hold. */
  question: string;
  /** The same question in different words, sharing as little wording as possible. */
  rephrasing: string;
  /** A question that only makes sense as a reply to the first one. */
  followUp: string;
  /** An objection asserting something the code does not support. */
  falseClaim: string;
  /**
   * A distinctive phrase from that false claim. If it appears in the answer
   * after the bot has re-read the code, the bot agreed with an objection the
   * code does not support -- which is the failure the dispute path exists to
   * avoid, and the single most important thing the soak checks.
   */
  falseClaimMarker: string;
}

/** Questions about this project, so `npm run soak` works here with no setup. */
export const DEFAULT_SCENARIO: SoakScenario = {
  question: 'What happens when someone asks a question the bot has no stored answer for?',
  rephrasing: 'if nothing is on file about my question, what do I get back?',
  followUp: 'and does it save what it finds?',
  falseClaim: 'that is wrong, it throws an error message at the user instead',
  falseClaimMarker: 'error message',
};

const FIELDS: Array<keyof SoakScenario> = [
  'question',
  'rephrasing',
  'followUp',
  'falseClaim',
  'falseClaimMarker',
];

/**
 * Deliberately strict, unlike the seeding plan parser. A plan is edited by hand
 * mid-task and should forgive a stray blank line; a scenario is written once,
 * and a silently missing field would make the soak quietly stop checking
 * something while still reporting PASS.
 */
export function parseScenario(raw: string, source = 'the scenario'): SoakScenario {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${source} is not valid JSON: ${reason}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${source} must be a JSON object with the fields: ${FIELDS.join(', ')}`);
  }

  const record = parsed as Record<string, unknown>;
  const scenario = {} as SoakScenario;

  for (const field of FIELDS) {
    const value = record[field];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${source} is missing a non-empty '${field}'`);
    }
    scenario[field] = value.trim();
  }

  if (!scenario.falseClaim.toLowerCase().includes(scenario.falseClaimMarker.toLowerCase())) {
    throw new Error(
      `${source}: falseClaimMarker '${scenario.falseClaimMarker}' does not appear in falseClaim, ` +
        'so the check that the bot did not adopt the claim would pass without testing anything',
    );
  }

  return scenario;
}
