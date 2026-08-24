import { query } from '@anthropic-ai/claude-agent-sdk';
import type { FollowUpResolver } from './followUp.js';
import type { ThreadContext } from './threadContext.js';

export interface ClaudeResolverConfig {
  model?: string;
  maxBudgetUsd?: number;
  /** Only used because the SDK wants somewhere to run; nothing here reads files. */
  cwd?: string;
}

/** How much of the conversation the rewrite is allowed to lean on. */
const REMEMBERED_TURNS = 6;

const INSTRUCTIONS = `You rewrite a follow-up question so that it can be understood on its own.

You are given the earlier questions from a conversation, in order, and the latest question. Return a single question that means exactly what the latest question means in that context, but which someone who never saw the conversation would understand.

Rules:
- If the latest question already stands on its own, return it unchanged.
- Keep the asker's wording wherever you can. You are resolving references, not improving the question.
- Resolve pronouns and omissions using the earlier questions only.
- Never answer the question, and never add detail the conversation does not contain.
- Return one question, phrased as a question.`;

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['standalone'],
  properties: {
    standalone: {
      type: 'string',
      description: 'The latest question, rewritten to stand on its own.',
    },
  },
};

export function createClaudeResolver(config: ClaudeResolverConfig = {}): FollowUpResolver {
  return {
    async resolve(question: string, thread: ThreadContext): Promise<string> {
      const earlier = thread.turns.slice(-REMEMBERED_TURNS).map((turn) => turn.resolved);
      if (earlier.length === 0) return question;

      const prompt = [
        'Earlier questions in this conversation:',
        ...earlier.map((asked, i) => `${i + 1}. ${asked}`),
        '',
        `Latest question: ${question}`,
      ].join('\n');

      try {
        for await (const message of query({
          prompt,
          options: {
            // No tools at all: this reads the conversation, never the codebase.
            tools: [],
            permissionMode: 'dontAsk',
            settingSources: [],
            persistSession: false,
            systemPrompt: INSTRUCTIONS,
            outputFormat: { type: 'json_schema', schema: SCHEMA },
            model: config.model,
            maxTurns: 1,
            maxBudgetUsd: config.maxBudgetUsd ?? 0.5,
            ...(config.cwd ? { cwd: config.cwd } : {}),
          },
        })) {
          if (message.type !== 'result') continue;
          if (message.subtype !== 'success') {
            console.warn(`[WARN] could not resolve a follow-up (${message.subtype})`);
            return question;
          }
          const standalone = readStandalone(message.structured_output);
          if (standalone) return standalone;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[WARN] could not resolve a follow-up: ${reason}`);
      }

      // Failing to resolve is not failing to answer. The question is passed
      // through as asked, which is exactly the behaviour before this existed.
      return question;
    },
  };
}

function readStandalone(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const standalone = (value as Record<string, unknown>)['standalone'];
  if (typeof standalone !== 'string') return undefined;
  const collapsed = standalone.replace(/\s+/g, ' ').trim();
  return collapsed || undefined;
}
