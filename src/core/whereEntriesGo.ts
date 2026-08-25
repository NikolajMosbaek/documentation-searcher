import { existsSync, mkdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

/**
 * Where a knowledge base belongs, and where it must never be.
 *
 * The PRD puts entries "alongside the code" so that "I can correct an entry and
 * have that correction reviewed alongside the change that caused it". That
 * means the repository holding the *codebase being documented*, not the one
 * holding the bot.
 *
 * Defaulting to the bot's own directory was both wrong against that and unsafe:
 * point the bot at a private codebase and descriptions of private code get
 * written into whatever repository the bot happens to live in -- which, for
 * this project, is a public one.
 */
export function knowledgeBaseFor(options: {
  /** DOCSEARCHER_KNOWLEDGE_BASE, if the operator named one. */
  configured?: string | undefined;
  /** The codebase being documented, if one is configured. */
  codebase?: string | undefined;
  /** Where this bot's own files live. */
  botRoot: string;
}): string {
  const { configured, codebase, botRoot } = options;

  // An explicit choice is always honoured -- but still checked below.
  if (configured) return resolve(configured);

  // Alongside the code it describes, per the PRD.
  if (codebase) return join(resolve(codebase), 'knowledge-base');

  // No codebase: nothing will be written, and the bot's own examples are what
  // there is to answer from.
  return join(botRoot, 'knowledge-base');
}

function isInside(parent: string, child: string): boolean {
  const between = relative(resolve(parent), resolve(child));
  return between === '' || (!between.startsWith('..') && !isAbsolute(between));
}

/**
 * Refuses to write descriptions of one repository into a different one.
 *
 * Entries are derived from a codebase and describe how it behaves. Storing them
 * anywhere other than beside that codebase means a repository ends up holding a
 * description of code it does not contain -- which is a leak when the codebase
 * is private and the store is not.
 */
export function assertEntriesStayWithTheirCode(options: {
  knowledgeBase: string;
  codebase?: string | undefined;
  botRoot: string;
}): void {
  const { knowledgeBase, codebase, botRoot } = options;

  // Nothing is derived without a codebase, so nothing can be misplaced.
  if (!codebase) return;

  // Documenting the bot itself: its own knowledge base is the right place.
  if (isInside(botRoot, codebase)) return;

  if (isInside(botRoot, knowledgeBase)) {
    throw new Error(
      [
        'Refusing to write entries about another codebase into this repository.',
        `  codebase being read : ${resolve(codebase)}`,
        `  entries would go to : ${resolve(knowledgeBase)}`,
        `  which is inside     : ${botRoot}`,
        '',
        'Entries describe the code they came from and belong beside it. Leave',
        'DOCSEARCHER_KNOWLEDGE_BASE unset to store them in the codebase itself,',
        'or set it to a path outside this repository.',
      ].join('\n'),
    );
  }
}

/** Creates the directory if it is missing, so a first run does not fail. */
export function ensureKnowledgeBase(path: string): string {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
  return path;
}
