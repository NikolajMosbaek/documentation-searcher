import { query } from '@anthropic-ai/claude-agent-sdk';
import type { CandidateJudge } from './judge.js';
import type { Entry } from './knowledgeBase.js';

export interface ClaudeJudgeConfig {
  model?: string;
  maxBudgetUsd?: number;
  cwd?: string;
}

const INSTRUCTIONS = `You decide whether an answer the system already holds actually answers a question that has just been asked.

You are given a question and a numbered list of stored answers. Choose the number of the one that answers the question. If none of them does, choose 0.

Choose a stored answer only if it genuinely answers what was asked. Being about the same general topic is not enough: someone asking about one behaviour is not served by an answer about a neighbouring one. When in doubt choose 0 — the cost of choosing 0 wrongly is that the question gets answered properly from scratch, while the cost of choosing wrongly is that someone is given an answer to a question they did not ask.`;

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['choice'],
  properties: {
    choice: {
      type: 'integer',
      description: 'The number of the stored answer that answers the question, or 0 for none.',
    },
  },
};

export function createClaudeJudge(config: ClaudeJudgeConfig = {}): CandidateJudge {
  return {
    async choose(question: string, candidates: Entry[]): Promise<Entry | undefined> {
      if (candidates.length === 0) return undefined;

      const prompt = [
        `Question: ${question}`,
        '',
        'Stored answers:',
        ...candidates.map((entry, i) => `${i + 1}. ${entry.title} -- ${entry.answer.shortAnswer}`),
      ].join('\n');

      try {
        for await (const message of query({
          prompt,
          options: {
            // Reads what is already stored, never the codebase.
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
            console.warn(`[WARN] could not weigh stored answers (${message.subtype})`);
            return undefined;
          }
          return pick(message.structured_output, candidates);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[WARN] could not weigh stored answers: ${reason}`);
      }

      // Failing to decide is deciding nothing: the question gets derived, which
      // is what would have happened before this existed.
      return undefined;
    },
  };
}

function pick(value: unknown, candidates: Entry[]): Entry | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const choice = (value as Record<string, unknown>)['choice'];
  if (typeof choice !== 'number' || !Number.isInteger(choice)) return undefined;
  if (choice < 1 || choice > candidates.length) return undefined;
  return candidates[choice - 1];
}
