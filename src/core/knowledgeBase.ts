import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findCodeReferences, type Answer } from './answer.js';
import type { Derivation } from './engine.js';
import { createRetrievalIndex, tokenize } from './retrieval.js';

export interface Entry {
  file: string;
  title: string;
  /**
   * Every question known to be answered by this entry. One behaviour can be
   * asked about in many ways, and each of those phrasings is a guaranteed way
   * back to it. Empty for a hand-written entry.
   */
  questions: string[];
  keywords: string[];
  /** Paths this entry was derived from, when a machine wrote it. Metadata only. */
  derivedFrom: string[];
  /** What those paths hashed to when the entry was written. Empty if hand-written. */
  fingerprint: string;
  answer: Answer;
}

/**
 * Entries are markdown files with a small frontmatter block, so a developer can
 * hand-edit one and have the diff read sensibly in review. The parser is
 * deliberately strict and dumb -- three known headings, nothing clever.
 */
export function parseEntry(file: string, raw: string): Entry {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.trim());
  if (!match) {
    throw new Error(`${file}: expected a frontmatter block delimited by ---`);
  }
  const [, frontmatter = '', body = ''] = match;

  const fields = new Map<string, string>();
  for (const line of frontmatter.split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }

  const title = fields.get('title');
  if (!title) throw new Error(`${file}: frontmatter is missing 'title'`);

  const keywords = splitList(fields.get('keywords')).map((keyword) => keyword.toLowerCase());
  const derivedFrom = splitList(fields.get('derived-from'));
  const fingerprint = fields.get('fingerprint') ?? '';

  const sections = splitSections(body);

  // Questions live in a section rather than frontmatter because they routinely
  // contain commas, which is how every other list here is separated. A single
  // `question:` field is still read, so entries written before this remain
  // readable and a developer can still add one by hand that way.
  const questions = unique([
    ...(fields.get('question') ? [fields.get('question')!.trim()] : []),
    ...(sections.get('questions') ?? []).map(stripListMarker),
  ]);

  const shortAnswer = sections.get('short answer');
  if (!shortAnswer) throw new Error(`${file}: missing a '## Short answer' section`);

  const answer: Answer = {
    shortAnswer: shortAnswer.join(' '),
    behaviour: (sections.get('what happens') ?? []).map(stripListMarker),
    edgeCases: (sections.get('edge cases') ?? []).map(stripListMarker),
    source: 'knowledge-base',
  };

  return { file, title, questions, keywords, derivedFrom, fingerprint, answer };
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeQuestion(value);
    if (!value.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitSections(body: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current: string[] | undefined;

  for (const line of body.split('\n')) {
    const heading = /^##\s+(.+)$/.exec(line.trim());
    if (heading) {
      current = [];
      sections.set(heading[1]!.trim().toLowerCase(), current);
      continue;
    }
    if (current && line.trim()) current.push(line.trim());
  }

  return sections;
}

function stripListMarker(line: string): string {
  return line.replace(/^(?:[-*]|\d+\.)\s*/, '');
}

/**
 * The inverse of `parseEntry`. Anything the bot writes has to come back out of
 * `parseEntry` unchanged, so the two are edited together or not at all.
 */
export function serializeEntry(derivation: Derivation, questions: string[] = []): string {
  const { answer, title, keywords, derivedFrom, fingerprint } = derivation;
  // Existing questions keep their order and the new one is appended, so a
  // merge shows up as one added line rather than a reshuffled list.
  const asked = unique([...questions, derivation.question]);

  const lines = [
    '---',
    `title: ${oneLine(title)}`,
    `keywords: ${keywords.map(commaFree).filter(Boolean).join(', ')}`,
    `derived-from: ${derivedFrom.map(commaFree).filter(Boolean).join(', ')}`,
    `fingerprint: ${fingerprint}`,
    '---',
    '',
  ];

  if (asked.length > 0) {
    lines.push('## Questions');
    for (const question of asked) lines.push(`- ${oneLine(question)}`);
    lines.push('');
  }

  lines.push('## Short answer', oneLine(answer.shortAnswer));

  if (answer.behaviour.length > 0) {
    lines.push('', '## What happens');
    answer.behaviour.forEach((step, i) => lines.push(`${i + 1}. ${oneLine(step)}`));
  }

  if (answer.edgeCases.length > 0) {
    lines.push('', '## Edge cases');
    answer.edgeCases.forEach((edgeCase) => lines.push(`- ${oneLine(edgeCase)}`));
  }

  return `${lines.join('\n')}\n`;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Commas separate list items in frontmatter, so they cannot appear inside one. */
function commaFree(value: string): string {
  return oneLine(value.replace(/,/g, ' '));
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'entry';
}

export function loadKnowledgeBase(directory: string): Entry[] {
  const entries: Entry[] = [];

  for (const name of readdirSync(directory).filter((file) => file.endsWith('.md')).sort()) {
    let entry: Entry;
    try {
      entry = parseEntry(name, readFileSync(join(directory, name), 'utf8'));
    } catch (error) {
      // One malformed file used to take the whole knowledge base down at
      // startup. That was tolerable while three files were hand-written; it is
      // not, now that the bot writes them itself.
      console.warn(`[WARN] skipped ${name}: ${describeError(error)}`);
      continue;
    }

    for (const line of findCodeReferences(entry.answer)) {
      console.warn(`[WARN] ${entry.file} reads like code, not product language: "${line}"`);
    }
    entries.push(entry);
  }

  return entries;
}

/** Punctuation and spacing must not decide whether a question is the same one. */
export function normalizeQuestion(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * The one thing answered without asking anybody: a question asked before in
 * exactly these words. Whoever paid for an entry, and anyone who phrases it the
 * same way, gets it back immediately and for nothing.
 *
 * Everything else is a judgement, and retrieval is no longer trusted to make
 * it — see `RetrievalIndex`. Callers that need an answer for a question phrased
 * differently ask for `candidates` and put them to a judge.
 */
export function findEntry(entries: Entry[], question: string): Entry | undefined {
  const normalized = normalizeQuestion(question);
  return entries.find((entry) =>
    entry.questions.some((asked) => normalizeQuestion(asked) === normalized),
  );
}

/**
 * Two derivations are the same behaviour when they came from exactly the same
 * code and say the same thing. Same code alone is not enough -- one file
 * describes many behaviours -- and similar wording alone is not enough either.
 */
export function isDuplicate(entry: Entry, derivation: Derivation): boolean {
  // Identical fingerprints mean both were derived against the same bytes, which
  // in practice means the same session. Overlapping *files* was considered as a
  // looser test and measured useless: in a small codebase every answer reads
  // most of the same files, so genuinely different behaviours overlap by 0.83
  // to 0.86, against 0.89 to 1.00 for real duplicates.
  //
  // The cost is that two entries derived either side of a code change never
  // merge, however alike they are. That is a known way for near-duplicates to
  // accumulate over time, and it is preferred to a rule that merges behaviours
  // which are merely neighbours.
  if (!entry.fingerprint || entry.fingerprint !== derivation.fingerprint) return false;
  return similarity(entry.answer.shortAnswer, derivation.answer.shortAnswer) >= DUPLICATE_SIMILARITY;
}

/**
 * Measured against real duplicates rather than imagined ones, twice.
 *
 * Iteration 12 set it to 0.6 from two sentences written to *resemble* a
 * re-derivation. Iteration 22 measured real ones on a twelve-entry corpus --
 * 0.400 and 0.500, ranking first and second of sixty-six pairs, with the
 * highest non-duplicate at 0.310 -- and moved it into that gap.
 *
 * Doubling the corpus removed the gap. Five pairs now describe the same
 * behaviour and score from 0.182 to 0.885, while the most alike pair that is
 * *not* the same behaviour scores 0.317. The distributions overlap, so no
 * threshold catches every duplicate without also merging entries that are
 * merely neighbours.
 *
 * 0.35 is therefore chosen for safety rather than coverage: nothing that is not
 * a duplicate reaches it, and the most obvious duplicates clear it. The rest
 * accumulate, which is a known and now measured limitation.
 */
export const DUPLICATE_SIMILARITY = 0.35;

/** Share of the words the two have in common, ignoring order and repetition. */
export function similarity(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/**
 * The knowledge base as the product sees it: something to look in, and something
 * to write back to. Files are the store, per the constitution -- there is no
 * database and none is coming.
 */
export interface KnowledgeBase {
  find(question: string): Entry | undefined;
  /** The entry stored in a given file, so a disputed answer can be traced back. */
  byFile(file: string): Entry | undefined;
  /** Entries that might answer the question but are not certain enough to serve. */
  candidates(question: string, limit?: number): Entry[];
  /**
   * Store a derivation and make it findable immediately -- unless an entry
   * already says the same thing about the same code, in which case the new
   * question is attached to that entry instead of a near-duplicate being
   * created beside it.
   */
  add(derivation: Derivation): Entry;
  /**
   * Refresh an entry in place after the code it described changed. Same file, so
   * the diff a developer reviews shows what moved rather than an unrelated pair
   * of additions and deletions. Every question already known to reach the entry
   * keeps reaching it.
   */
  replace(entry: Entry, derivation: Derivation): Entry;
  readonly size: number;
}

export function createKnowledgeBase(directory: string): KnowledgeBase {
  const entries = loadKnowledgeBase(directory);

  // Rebuilt whenever an entry is written, because document frequencies shift
  // with the corpus -- a stale index would rank against a knowledge base that
  // no longer exists. Used only for shortlisting; nothing here decides.
  let index = createRetrievalIndex(entries);
  const reindex = () => {
    index = createRetrievalIndex(entries);
  };

  return {
    find(question: string): Entry | undefined {
      return findEntry(entries, question);
    },

    byFile(file: string): Entry | undefined {
      return entries.find((entry) => entry.file === file);
    },

    candidates(question: string, limit?: number): Entry[] {
      return index.candidates(question, limit).map((match) => match.entry);
    },

    add(derivation: Derivation): Entry {
      // Two phrasings of the same question both miss, both get derived, and the
      // knowledge base ends up with two entries saying the same thing that
      // retrieval then picks between arbitrarily. Attaching the question to the
      // entry that already exists is the whole fix.
      const same = entries.find((entry) => isDuplicate(entry, derivation));
      if (same) {
        console.log(`[INFO] ${same.file} already covers this; attaching the question to it`);
        return this.replace(same, derivation);
      }

      const file = availableFile(directory, slugify(derivation.title));
      writeFileSync(join(directory, file), serializeEntry(derivation), 'utf8');

      const entry = toEntry(file, derivation);
      entries.push(entry);
      reindex();
      return entry;
    },

    replace(existing: Entry, derivation: Derivation): Entry {
      // Keep every question already known to reach this entry. A refresh may
      // have been triggered by one of several phrasings, and the others must
      // not stop working because of it.
      const questions = existing.questions;
      writeFileSync(join(directory, existing.file), serializeEntry(derivation, questions), 'utf8');

      const refreshed = toEntry(existing.file, derivation, questions);
      const at = entries.indexOf(existing);
      if (at === -1) entries.push(refreshed);
      else entries[at] = refreshed;
      reindex();
      return refreshed;
    },

    get size(): number {
      return entries.length;
    },
  };
}

function toEntry(file: string, derivation: Derivation, questions: string[] = []): Entry {
  return {
    file,
    title: derivation.title,
    questions: unique([...questions, derivation.question]),
    keywords: derivation.keywords,
    derivedFrom: derivation.derivedFrom,
    fingerprint: derivation.fingerprint,
    answer: { ...derivation.answer, source: 'knowledge-base' },
  };
}

/** Never overwrite an existing entry -- a developer may have written it. */
function availableFile(directory: string, slug: string): string {
  if (!existsSync(join(directory, `${slug}.md`))) return `${slug}.md`;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${slug}-${suffix}.md`;
    if (!existsSync(join(directory, candidate))) return candidate;
  }
  throw new Error(`cannot find a free filename for '${slug}'`);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
