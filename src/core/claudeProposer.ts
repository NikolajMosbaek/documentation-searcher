import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Area, AreaProposer } from './seeding.js';

export interface ClaudeProposerConfig {
  codebase: string;
  model?: string;
  maxBudgetUsd?: number;
}

const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob'];

const INSTRUCTIONS = `You are looking at a codebase in order to propose what is worth documenting first, for an audience of product owners, testers and support staff who do not read code.

Find the behaviours those people would ask about: what the product does, when, and what happens at the edges. Rank by how likely someone is to ask, not by how interesting the code is.

For each area give a short title in product language, one sentence on why it is worth documenting before the others, and two or three questions phrased the way an asker would type them into a chat.

Rules:
- Titles and reasons use product language: no file paths, no function or class names, no code snippets.
- Questions must be answerable from this codebase. Do not propose an area the code does not cover.
- Do not propose areas about the build, the tests, the tooling, or the repository layout. Nobody asks a chat bot about those.`;

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['areas'],
  properties: {
    areas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'why', 'questions'],
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          questions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

export function createClaudeProposer(config: ClaudeProposerConfig): AreaProposer {
  return {
    async propose(limit: number): Promise<Area[]> {
      let structured: unknown;

      try {
        for await (const message of query({
          prompt: `Propose at most ${limit} areas of this codebase worth documenting first.`,
          options: {
            cwd: config.codebase,
            tools: READ_ONLY_TOOLS,
            allowedTools: READ_ONLY_TOOLS,
            permissionMode: 'dontAsk',
            settingSources: [],
            persistSession: false,
            systemPrompt: {
              type: 'preset',
              preset: 'claude_code',
              append: INSTRUCTIONS,
              excludeDynamicSections: true,
            },
            outputFormat: { type: 'json_schema', schema: SCHEMA },
            model: config.model,
            maxTurns: 40,
            maxBudgetUsd: config.maxBudgetUsd ?? 5,
          },
        })) {
          if (message.type !== 'result') continue;
          if (message.subtype !== 'success') {
            console.warn(`[WARN] could not propose areas (${message.subtype})`);
            return [];
          }
          structured = message.structured_output;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[WARN] could not propose areas: ${reason}`);
        return [];
      }

      return toAreas(structured, limit);
    },
  };
}

function toAreas(value: unknown, limit: number): Area[] {
  if (typeof value !== 'object' || value === null) return [];
  const raw = (value as Record<string, unknown>)['areas'];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): Area | undefined => {
      if (typeof item !== 'object' || item === null) return undefined;
      const record = item as Record<string, unknown>;
      const title = asText(record['title']);
      const questions = asTextArray(record['questions']);
      if (!title || questions.length === 0) return undefined;
      // Nothing is chosen for the developer. That is the entire point.
      return { title, why: asText(record['why']), questions, chosen: false };
    })
    .filter((area): area is Area => area !== undefined)
    .slice(0, limit);
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asText).filter(Boolean);
}
