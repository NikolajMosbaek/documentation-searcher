import type { Answer } from './answer.js';

/**
 * Conversation memory. In-memory on purpose -- it stays a Map until a fake
 * genuinely can't cut it.
 */
export interface Turn {
  /** What the asker typed. */
  question: string;
  /**
   * The same question made to stand on its own. Equal to `question` unless it
   * was a follow-up. Later turns resolve against this rather than the raw text,
   * so a chain of follow-ups does not decay one reference at a time.
   */
  resolved: string;
  /** Tracks the answer's own provenance rather than restating it. */
  answeredFrom: Answer['source'];
  /** Which stored entry answered, when one did. What a dispute acts on. */
  entryFile?: string;
}

export interface ThreadContext {
  threadId: string;
  turns: readonly Turn[];
}

export class InMemoryThreadStore {
  private readonly threads = new Map<string, Turn[]>();

  get(threadId: string): ThreadContext {
    return { threadId, turns: this.threads.get(threadId) ?? [] };
  }

  record(threadId: string, turn: Turn): void {
    const turns = this.threads.get(threadId) ?? [];
    turns.push(turn);
    this.threads.set(threadId, turns);
  }
}
