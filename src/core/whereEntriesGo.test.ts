import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { assertEntriesStayWithTheirCode, knowledgeBaseFor } from './whereEntriesGo.js';
import { loadKnowledgeBase } from './knowledgeBase.js';

const BOT = '/srv/documentation-searcher';

test('entries default to living beside the code they describe', () => {
  assert.equal(
    knowledgeBaseFor({ codebase: '/work/private-api', botRoot: BOT }),
    join('/work/private-api', 'knowledge-base'),
  );
});

test('with no codebase, the bot falls back to its own examples', () => {
  assert.equal(knowledgeBaseFor({ botRoot: BOT }), join(BOT, 'knowledge-base'));
});

test('an explicit choice is honoured', () => {
  assert.equal(
    knowledgeBaseFor({ configured: '/var/kb', codebase: '/work/private-api', botRoot: BOT }),
    '/var/kb',
  );
});

test('writing descriptions of another codebase into this repository is refused', () => {
  // The failure this exists for: a private codebase, and entries about it
  // landing in whatever repository the bot happens to live in.
  assert.throws(
    () =>
      assertEntriesStayWithTheirCode({
        knowledgeBase: join(BOT, 'knowledge-base'),
        codebase: '/work/private-api',
        botRoot: BOT,
      }),
    /Refusing to write entries about another codebase/,
  );

  // Including via an explicit setting that points back inside.
  assert.throws(
    () =>
      assertEntriesStayWithTheirCode({
        knowledgeBase: join(BOT, 'src', 'core', 'fixtures', 'corpus'),
        codebase: '/work/private-api',
        botRoot: BOT,
      }),
    /Refusing to write entries about another codebase/,
  );
});

test('the arrangements that are fine are allowed', () => {
  // Beside the codebase.
  assertEntriesStayWithTheirCode({
    knowledgeBase: '/work/private-api/knowledge-base',
    codebase: '/work/private-api',
    botRoot: BOT,
  });
  // Somewhere else entirely.
  assertEntriesStayWithTheirCode({
    knowledgeBase: '/var/kb',
    codebase: '/work/private-api',
    botRoot: BOT,
  });
  // The bot documenting itself, which is what this repository's own entries are.
  assertEntriesStayWithTheirCode({
    knowledgeBase: join(BOT, 'knowledge-base'),
    codebase: BOT,
    botRoot: BOT,
  });
  // Nothing configured, so nothing will be derived.
  assertEntriesStayWithTheirCode({ knowledgeBase: join(BOT, 'knowledge-base'), botRoot: BOT });
});

/**
 * Belt and braces. The guard above stops entries being written in the wrong
 * place; this catches anything that got there another way -- a hand-copied
 * file, a run from before the guard existed.
 */
test('no entry committed to this repository describes code outside it', () => {
  const root = join(import.meta.dirname, '..', '..');
  const escaping: string[] = [];

  for (const directory of ['knowledge-base', 'src/core/fixtures/corpus']) {
    for (const entry of loadKnowledgeBase(join(root, directory))) {
      for (const source of entry.derivedFrom) {
        // Anything absolute, or climbing out, describes code this repository
        // does not contain.
        if (source.startsWith('/') || source.split('/').includes('..')) {
          escaping.push(`${directory}/${entry.file}: ${source}`);
        }
      }
    }
  }

  assert.deepEqual(escaping, [], 'an entry describes code outside this repository');
});
