import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findCodeReferences, type Answer } from './answer.js';
import type { Derivation } from './engine.js';

export interface Entry {
  file: string;
  title: string;
  /** The question that produced this entry, if a machine wrote it. */
  question: string;
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
  const question = fields.get('question') ?? '';

  const sections = splitSections(body);
  const shortAnswer = sections.get('short answer');
  if (!shortAnswer) throw new Error(`${file}: missing a '## Short answer' section`);

  const answer: Answer = {
    shortAnswer: shortAnswer.join(' '),
    behaviour: (sections.get('what happens') ?? []).map(stripListMarker),
    edgeCases: (sections.get('edge cases') ?? []).map(stripListMarker),
    source: 'knowledge-base',
  };

  return { file, title, question, keywords, derivedFrom, fingerprint, answer };
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
export function serializeEntry(derivation: Derivation): string {
  const { answer, title, question, keywords, derivedFrom, fingerprint } = derivation;

  const lines = [
    '---',
    `title: ${oneLine(title)}`,
    `question: ${oneLine(question)}`,
    `keywords: ${keywords.map(commaFree).filter(Boolean).join(', ')}`,
    `derived-from: ${derivedFrom.map(commaFree).filter(Boolean).join(', ')}`,
    `fingerprint: ${fingerprint}`,
    '---',
    '',
    '## Short answer',
    oneLine(answer.shortAnswer),
  ];

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
 * Retrieval, in name only. A keyword count is not retrieval and is not meant to
 * be -- it is a placeholder holding the seam open until the real lookup arrives.
 *
 * The one thing it does guarantee is that asking the same question twice finds
 * the entry the first asking paid for. Keywords cannot promise that: they are
 * the model's words for the behaviour, not the asker's words for the question,
 * and the two routinely fail to overlap.
 */
export function findEntry(entries: Entry[], question: string): Entry | undefined {
  const normalized = normalizeQuestion(question);
  const sameQuestion = entries.find(
    (entry) => entry.question && normalizeQuestion(entry.question) === normalized,
  );
  if (sameQuestion) return sameQuestion;

  const asked = question.toLowerCase();

  const scored = entries
    .map((entry) => ({
      entry,
      score: entry.keywords.filter((keyword) => asked.includes(keyword)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.entry;
}

/**
 * The knowledge base as the product sees it: something to look in, and something
 * to write back to. Files are the store, per the constitution -- there is no
 * database and none is coming.
 */
export interface KnowledgeBase {
  find(question: string): Entry | undefined;
  /** Store a derivation and make it findable immediately. */
  add(derivation: Derivation): Entry;
  /**
   * Refresh an entry in place after the code it described changed. Same file, so
   * the diff a developer reviews shows what moved rather than an unrelated pair
   * of additions and deletions.
   */
  replace(entry: Entry, derivation: Derivation): Entry;
  readonly size: number;
}

export function createKnowledgeBase(directory: string): KnowledgeBase {
  const entries = loadKnowledgeBase(directory);

  return {
    find(question: string): Entry | undefined {
      return findEntry(entries, question);
    },

    add(derivation: Derivation): Entry {
      const file = availableFile(directory, slugify(derivation.title));
      writeFileSync(join(directory, file), serializeEntry(derivation), 'utf8');

      const entry = toEntry(file, derivation);
      entries.push(entry);
      return entry;
    },

    replace(existing: Entry, derivation: Derivation): Entry {
      writeFileSync(join(directory, existing.file), serializeEntry(derivation), 'utf8');

      const refreshed = toEntry(existing.file, derivation);
      const at = entries.indexOf(existing);
      if (at === -1) entries.push(refreshed);
      else entries[at] = refreshed;
      return refreshed;
    },

    get size(): number {
      return entries.length;
    },
  };
}

function toEntry(file: string, derivation: Derivation): Entry {
  return {
    file,
    title: derivation.title,
    question: derivation.question,
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
