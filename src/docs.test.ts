import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/**
 * The README goes stale silently, and it did: three of its claims survived
 * twelve iterations of edits because every one of those edits added a
 * paragraph and none re-read the rest. The bot re-checks its own entries
 * against the code they came from on every read; this is the equivalent for
 * the one document nothing else checks.
 *
 * Only the mechanical claims are checkable -- which files exist, which
 * settings are read. Prose still needs reading.
 */
const ROOT = join(import.meta.dirname, '..');
const README = readFileSync(join(ROOT, 'README.md'), 'utf8');
const PACKAGE = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

function sourceFiles(directory = 'src'): string[] {
  return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

/** The paths listed in the README's Layout block, ignoring globs and directories. */
function documentedPaths(): string[] {
  const block = /## Layout[\s\S]*?```\n([\s\S]*?)```/.exec(README);
  assert.ok(block, 'the README has no Layout block');

  return block[1]!
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[0] ?? '')
    .filter((path) => path && !path.endsWith('/') && !path.includes('*'));
}

test('every source file is described in the README', () => {
  const documented = new Set(documentedPaths());
  const undocumented = sourceFiles().filter((file) => !documented.has(file));

  assert.deepEqual(undocumented, [], `added to src but not to the README's Layout block`);
});

test('every file the README describes exists', () => {
  const missing = documentedPaths().filter((path) => !existsSync(join(ROOT, path)));

  assert.deepEqual(missing, [], 'described in the README but not on disk');
});

/** Every setting the code reads, from anywhere under src. */
function settingsRead(): Set<string> {
  const found = new Set<string>();
  for (const file of sourceFiles()) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    for (const [, name] of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      found.add(name!);
    }
  }
  return found;
}

/** Every setting named in the first column of the README's configuration table. */
function settingsDocumented(): Set<string> {
  return new Set([...README.matchAll(/^\| `([A-Z][A-Z0-9_]*)`/gm)].map(([, name]) => name!));
}

test('every setting the code reads is documented', () => {
  const documented = settingsDocumented();
  const undocumented = [...settingsRead()].filter((name) => !documented.has(name)).sort();

  // NODE_ENV was the one this found: read to decide whether unauthenticated
  // requests are accepted, and described only in prose.
  assert.deepEqual(undocumented, [], 'read from the environment but not in the configuration table');
});

test('every documented setting is actually read', () => {
  const read = settingsRead();
  const phantom = [...settingsDocumented()].filter((name) => !read.has(name)).sort();

  assert.deepEqual(phantom, [], 'documented as configuration but read nowhere');
});

test('every command the README tells you to run exists', () => {
  const scripts = new Set(Object.keys(PACKAGE.scripts));
  const referenced = [...README.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)].map(([, name]) => name!);
  const missing = [...new Set(referenced)].filter((name) => !scripts.has(name)).sort();

  assert.deepEqual(missing, [], 'the README tells you to run a script that does not exist');
});
