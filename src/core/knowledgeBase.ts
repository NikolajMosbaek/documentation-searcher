import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findCodeReferences, type Answer } from './answer.js';

export interface Entry {
  file: string;
  title: string;
  keywords: string[];
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

  const keywords = (fields.get('keywords') ?? '')
    .split(',')
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);

  const sections = splitSections(body);
  const shortAnswer = sections.get('short answer');
  if (!shortAnswer) throw new Error(`${file}: missing a '## Short answer' section`);

  const answer: Answer = {
    shortAnswer: shortAnswer.join(' '),
    behaviour: (sections.get('what happens') ?? []).map(stripListMarker),
    edgeCases: (sections.get('edge cases') ?? []).map(stripListMarker),
    source: 'knowledge-base',
  };

  return { file, title, keywords, answer };
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

export function loadKnowledgeBase(directory: string): Entry[] {
  const entries = readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .map((name) => parseEntry(name, readFileSync(join(directory, name), 'utf8')));

  for (const entry of entries) {
    const leaked = findCodeReferences(entry.answer);
    for (const line of leaked) {
      console.warn(`[WARN] ${entry.file} reads like code, not product language: "${line}"`);
    }
  }

  return entries;
}

/**
 * Retrieval, in name only. A keyword count is not retrieval and is not meant to
 * be -- it is a placeholder holding the seam open until the real lookup arrives.
 */
export function findEntry(entries: Entry[], question: string): Entry | undefined {
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
