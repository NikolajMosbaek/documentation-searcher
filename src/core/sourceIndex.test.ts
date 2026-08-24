import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createSourceIndex } from './sourceIndex.js';

function codebase(): string {
  const root = mkdtempSync(join(tmpdir(), 'docsearch-src-'));
  mkdirSync(join(root, 'inner'), { recursive: true });
  writeFileSync(join(root, 'billing.ts'), 'the original billing rules\n');
  writeFileSync(join(root, 'inner', 'ledger.ts'), 'the original ledger\n');
  return root;
}

test('the same files always fingerprint the same, whatever order they arrive in', () => {
  const root = codebase();
  const sources = createSourceIndex(root);
  const paths = ['billing.ts', 'inner/ledger.ts'];

  assert.equal(sources.fingerprint(paths), sources.fingerprint(paths));
  assert.equal(sources.fingerprint(paths), sources.fingerprint([...paths].reverse()));
  assert.equal(sources.fingerprint(paths), sources.fingerprint([...paths, 'billing.ts']));
  rmSync(root, { recursive: true, force: true });
});

test('editing a file changes the fingerprint, and undoing the edit restores it', () => {
  const root = codebase();
  const sources = createSourceIndex(root);
  const paths = ['billing.ts', 'inner/ledger.ts'];
  const before = sources.fingerprint(paths);

  writeFileSync(join(root, 'billing.ts'), 'the billing rules, rewritten\n');
  assert.notEqual(sources.fingerprint(paths), before);

  writeFileSync(join(root, 'billing.ts'), 'the original billing rules\n');
  assert.equal(sources.fingerprint(paths), before);
  rmSync(root, { recursive: true, force: true });
});

test('deleting a described file makes the entry stale rather than fresh-looking', () => {
  const root = codebase();
  const sources = createSourceIndex(root);
  const paths = ['billing.ts', 'inner/ledger.ts'];
  const before = sources.fingerprint(paths);

  unlinkSync(join(root, 'inner', 'ledger.ts'));
  assert.notEqual(sources.fingerprint(paths), before);
  rmSync(root, { recursive: true, force: true });
});

test('a path escaping the codebase is never read', () => {
  const root = codebase();
  const outside = join(root, '..', `docsearch-outside-${process.pid}.txt`);
  writeFileSync(outside, 'first\n');

  const sources = createSourceIndex(join(root));
  const escaping = [`../${outside.split('/').pop()!}`];
  const before = sources.fingerprint(escaping);

  // If the file were being read, rewriting it would move the fingerprint.
  writeFileSync(outside, 'second, and quite different\n');
  assert.equal(sources.fingerprint(escaping), before);

  unlinkSync(outside);
  rmSync(root, { recursive: true, force: true });
});
