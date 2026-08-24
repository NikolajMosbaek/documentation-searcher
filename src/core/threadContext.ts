/**
 * Conversation memory. In-memory on purpose -- it stays a Map until a fake
 * genuinely can't cut it.
 */
export interface Turn {
  question: string;
  answeredFrom: 'knowledge-base' | 'miss';
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
