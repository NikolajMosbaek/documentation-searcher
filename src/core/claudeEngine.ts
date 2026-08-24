import { query } from '@anthropic-ai/claude-agent-sdk';
import { findCodeReferences, type Answer } from './answer.js';
import type { AnalysisEngine, Derivation } from './engine.js';
import { createSourceIndex, type SourceIndex } from './sourceIndex.js';

export interface ClaudeEngineConfig {
  /** Absolute path to the codebase this deployment answers questions about. */
  codebase: string;
  /** Overridable so a deployment can trade cost against depth. */
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
}

/**
 * Reading tools only. Three separate options are needed to make that true:
 * `tools` decides what exists at all, `allowedTools` stops the session pausing
 * to ask about them, and `dontAsk` denies anything not on the list instead of
 * prompting a user who isn't there. Restricting `allowedTools` alone would not
 * do it -- that option only auto-approves, it does not remove.
 */
const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob'];

/**
 * The product-language rules. They live in the core, next to the answer shape
 * they serve, because the constitution forbids a transport adapter from having
 * any say in how an answer reads.
 */
const INSTRUCTIONS = `You answer questions about a codebase for people who do not read code: product owners, testers, and support staff.

Read the codebase to establish how it actually behaves, then describe that behaviour the way someone using the product would describe it.

Rules for every string in shortAnswer, behaviour and edgeCases:
- No file paths, directory names, or file extensions.
- No function, method, class, type, or variable names.
- No code snippets, and no backticks.
- No line numbers.

If you cannot say something without naming code, say it more plainly or leave it out.

Set answered to true only when you found the behaviour in the code. If the codebase does not cover the question, set answered to false and leave the answer fields empty. Never guess, and never describe what the code probably does.

derivedFrom is the exception to the rules above: list there the file paths you actually read to reach the answer. It is metadata for a later staleness check and is never shown to anyone.`;

const DERIVATION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['answered', 'title', 'keywords', 'shortAnswer', 'behaviour', 'edgeCases', 'derivedFrom'],
  properties: {
    answered: {
      type: 'boolean',
      description: 'True only if the behaviour was found in the codebase.',
    },
    title: {
      type: 'string',
      description: 'A short title for this behaviour, in product language.',
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Words and phrases an asker would use for this behaviour.',
    },
    shortAnswer: {
      type: 'string',
      description: 'One or two sentences answering the question directly.',
    },
    behaviour: {
      type: 'array',
      items: { type: 'string' },
      description: 'The behaviour as ordered steps.',
    },
    edgeCases: {
      type: 'array',
      items: { type: 'string' },
      description: 'Conditions and exceptions that change the behaviour.',
    },
    derivedFrom: {
      type: 'array',
      items: { type: 'string' },
      description: 'Paths of the files actually read. Metadata, never shown.',
    },
  },
};

export function createClaudeEngine(config: ClaudeEngineConfig): AnalysisEngine {
  const sources = createSourceIndex(config.codebase);

  return {
    async deriveAnswer(question: string): Promise<Derivation | null> {
      let structured: unknown;

      try {
        for await (const message of query({
          prompt: question,
          options: {
            cwd: config.codebase,
            tools: READ_ONLY_TOOLS,
            allowedTools: READ_ONLY_TOOLS,
            permissionMode: 'dontAsk',
            // The codebase under analysis must not be able to instruct the
            // engine that is reading it. Omitting this loads that repository's
            // own CLAUDE.md and settings into the session, which would let any
            // checkout we point at rewrite these rules.
            settingSources: [],
            persistSession: false,
            systemPrompt: {
              type: 'preset',
              preset: 'claude_code',
              append: INSTRUCTIONS,
              excludeDynamicSections: true,
            },
            outputFormat: { type: 'json_schema', schema: DERIVATION_SCHEMA },
            model: config.model,
            maxTurns: config.maxTurns ?? 40,
            maxBudgetUsd: config.maxBudgetUsd,
          },
        })) {
          if (message.type !== 'result') continue;

          if (message.subtype !== 'success') {
            console.warn(`[WARN] analysis did not complete (${message.subtype})`);
            return null;
          }
          structured = message.structured_output;
        }
      } catch (error) {
        // An unreachable or unauthenticated engine is a miss, not an outage:
        // the asker gets an honest "I don't know" instead of a stack trace.
        console.warn(`[WARN] analysis engine unavailable: ${describeError(error)}`);
        return null;
      }

      const derivation = toDerivation(structured, sources, question);
      if (!derivation) return null;

      // A stored entry is served to every future asker, so a leak here is worse
      // than a miss. Discard rather than persist an answer that breaks the rules.
      const leaked = findCodeReferences(derivation.answer);
      if (leaked.length > 0) {
        for (const line of leaked) {
          console.warn(`[WARN] discarded a derived answer that reads like code: "${line}"`);
        }
        return null;
      }

      return derivation;
    },
  };
}

/** `structured_output` is typed `unknown`, so nothing about it is assumed. */
function toDerivation(value: unknown, sources: SourceIndex, question: string): Derivation | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (raw['answered'] !== true) return null;

  const title = collapse(asString(raw['title']));
  const shortAnswer = collapse(asString(raw['shortAnswer']));
  if (!title || !shortAnswer) return null;

  const answer: Answer = {
    shortAnswer,
    behaviour: asStringArray(raw['behaviour']),
    edgeCases: asStringArray(raw['edgeCases']),
    source: 'engine',
  };

  const derivedFrom = asStringArray(raw['derivedFrom']);

  return {
    answer,
    question,
    title,
    keywords: asStringArray(raw['keywords']).map((keyword) => keyword.toLowerCase()),
    derivedFrom,
    // Taken now, against the same working tree the answer was just read from.
    fingerprint: sources.fingerprint(derivedFrom),
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => collapse(asString(item))).filter(Boolean);
}

/** Entries are line-oriented markdown, so no answer string may span lines. */
function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
