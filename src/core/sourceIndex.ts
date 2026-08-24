import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/**
 * Answers whether the code an entry was derived from still looks the way it did
 * when the entry was written. A content hash rather than a timestamp: entries
 * are committed and checked out on machines that never saw the original write,
 * so modification times say nothing useful.
 */
export interface SourceIndex {
  fingerprint(paths: string[]): string;
}

export function createSourceIndex(codebase: string): SourceIndex {
  const root = resolve(codebase);

  return {
    fingerprint(paths: string[]): string {
      const hash = createHash('sha256');
      // Sorted and de-duplicated so the same set of files always hashes the
      // same, whatever order the engine happened to report them in.
      for (const path of [...new Set(paths)].sort()) {
        hash.update(path);
        hash.update('\0');
        hash.update(readContents(root, path));
        hash.update('\0');
      }
      return hash.digest('hex').slice(0, 16);
    },
  };
}

/**
 * A deleted file has to hash to something stable and distinct, otherwise
 * removing the code an entry describes would leave that entry looking fresh.
 */
function readContents(root: string, path: string): string {
  const resolved = resolve(root, path);

  // These paths were produced by the model, so they are untrusted input to a
  // file read. Anything resolving outside the codebase is treated as absent
  // rather than followed.
  const inside = relative(root, resolved);
  if (inside.startsWith('..') || isAbsolute(inside)) return '\0outside';

  try {
    return readFileSync(resolved, 'utf8');
  } catch {
    return '\0missing';
  }
}
