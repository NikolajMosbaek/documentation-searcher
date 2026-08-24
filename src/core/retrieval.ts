import type { Entry } from './knowledgeBase.js';

/**
 * Lookup over the knowledge base. Lexical and in-memory, per the constitution:
 * the entries are files, and nothing here needs a database or an index server.
 *
 * This is BM25 over a handful of weighted fields. It is not semantic -- a
 * question sharing no vocabulary with an entry will not find it -- but it is
 * real retrieval rather than the substring count it replaces, and it scores
 * every word of an entry rather than only its curated keywords.
 */
export interface RetrievalIndex {
  best(question: string): Match | undefined;
  /**
   * Entries that share something with the question but not enough to be served
   * on that evidence alone. The band between "obviously right" and "nothing at
   * all", where a cheap second opinion is worth more than a dollar derivation.
   */
  candidates(question: string, limit?: number): Match[];
  /** Exposed so the tuning of the threshold can be inspected and tested. */
  rank(question: string): Match[];
}

export interface Match {
  entry: Entry;
  score: number;
  /** Share of the question's content words that appear in the entry at all. */
  coverage: number;
}

/**
 * A match has to clear both bars. Score alone rewards a long entry that happens
 * to contain one rare word; coverage alone rewards a short entry that contains
 * several common ones. Answering from a wrong entry is worse than missing,
 * because a miss re-derives and a wrong hit is served silently forever.
 */
const MIN_SCORE = 1.0;
const MIN_COVERAGE = 0.34;

/**
 * At or below this many entries, a lexical score carries very little. Words are
 * shared by most of the corpus, so inverse document frequency has almost
 * nothing to distinguish, and a question that matches nothing may simply be one
 * the statistics cannot see. A second opinion on the whole knowledge base is
 * cheap at this size and far cheaper than deriving an answer that already
 * exists, so nothing is written off on lexical evidence alone.
 */
const TOO_SMALL_TO_JUDGE_LEXICALLY = 5;

const K1 = 1.2;
const B = 0.75;

const FIELD_WEIGHTS: Array<[keyof FieldText, number]> = [
  ['keywords', 3],
  ['title', 2],
  ['question', 2],
  ['shortAnswer', 2],
  ['body', 1],
];

interface FieldText {
  keywords: string;
  title: string;
  question: string;
  shortAnswer: string;
  body: string;
}

interface Document {
  entry: Entry;
  /** Term -> weighted frequency. */
  terms: Map<string, number>;
  length: number;
}

export function createRetrievalIndex(entries: Entry[]): RetrievalIndex {
  const documents = entries.map(toDocument);
  const averageLength =
    documents.reduce((total, document) => total + document.length, 0) / (documents.length || 1);

  const documentFrequency = new Map<string, number>();
  for (const document of documents) {
    for (const term of document.terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  function rank(question: string): Match[] {
    const queryTerms = [...new Set(tokenize(question))];
    if (queryTerms.length === 0) return [];

    return documents
      .map((document) => {
        let score = 0;
        let matched = 0;

        for (const term of queryTerms) {
          const frequency = document.terms.get(term);
          if (!frequency) continue;
          matched += 1;
          score += idf(term) * saturate(frequency, document.length);
        }

        return { entry: document.entry, score, coverage: matched / queryTerms.length };
      })
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  function idf(term: string): number {
    const seenIn = documentFrequency.get(term) ?? 0;

    // A word in every entry says nothing about which entry to pick, so it is
    // worth nothing. Without this the formula still awards it weight, and on a
    // very small knowledge base -- which is what every deployment starts with,
    // and what a freshly seeded one stays as for a while -- *every* word is in
    // every entry. One long entry then matched almost anything: measured on a
    // single-entry base, questions it plainly did not answer scored 1.47 to
    // 1.65 against bars of 1.0 and 0.34, and were served.
    //
    // That failure bypasses the second opinion entirely, because a judge is
    // only asked about candidates that fell *short* of the bars.
    if (seenIn === 0 || seenIn === documents.length) return 0;

    return Math.log(1 + (documents.length - seenIn + 0.5) / (seenIn + 0.5));
  }

  function saturate(frequency: number, length: number): number {
    return (frequency * (K1 + 1)) / (frequency + K1 * (1 - B + (B * length) / averageLength));
  }

  function clears(match: Match): boolean {
    return match.score >= MIN_SCORE && match.coverage >= MIN_COVERAGE;
  }

  return {
    rank,
    best(question: string): Match | undefined {
      const top = rank(question)[0];
      return top && clears(top) ? top : undefined;
    },
    candidates(question: string, limit = 5): Match[] {
      const ranked = rank(question);

      // The uncertain band: ranked, but not confidently enough to serve.
      const uncertain = ranked.filter((match) => !clears(match)).slice(0, limit);
      if (uncertain.length > 0) return uncertain;

      // An empty band because something cleared the bars is not the same as an
      // empty band because nothing scored at all. Only the second is a shortage
      // of evidence; the first already has an answer.
      if (ranked.length > 0) return [];

      // Nothing scored. On a large enough knowledge base that means the question
      // shares no word with anything, and there is nothing to weigh. On a small
      // one it may only mean the statistics are too thin to say.
      if (documents.length > TOO_SMALL_TO_JUDGE_LEXICALLY) return [];

      return documents
        .slice(0, limit)
        .map((document) => ({ entry: document.entry, score: 0, coverage: 0 }));
    },
  };
}

function toDocument(entry: Entry): Document {
  const fields: FieldText = {
    keywords: entry.keywords.join(' '),
    title: entry.title,
    question: entry.questions.join(' '),
    shortAnswer: entry.answer.shortAnswer,
    body: [...entry.answer.behaviour, ...entry.answer.edgeCases].join(' '),
  };

  const terms = new Map<string, number>();
  let length = 0;

  for (const [field, weight] of FIELD_WEIGHTS) {
    for (const term of tokenize(fields[field])) {
      terms.set(term, (terms.get(term) ?? 0) + weight);
      length += weight;
    }
  }

  return { entry, terms, length };
}

/**
 * Function words carry no signal and their sheer frequency would otherwise let
 * a question match everything. Everything else is left to IDF, which demotes a
 * common word without anyone having to predict which words those are.
 */
const STOPWORDS = new Set(
  ('a an the is are was were be been being do does did doing what when where how why who whom which ' +
    'if whether i my me we our you your it its they them their to of in on at for from by with and or ' +
    'but that this these those there as so than then will would shall should can could may might must ' +
    'have has had not no any some about happen happens')
    .split(' '),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stem);
}

/**
 * Crude on purpose. Enough to unify "cancels"/"cancelling"/"cancelled" so an
 * asker's phrasing reaches an entry written in another, and no more than that.
 */
function stem(word: string): string {
  if (word.length <= 3) return word;

  let stemmed = word;
  if (stemmed.endsWith('ies')) stemmed = `${stemmed.slice(0, -3)}y`;
  else if (stemmed.endsWith('sses')) stemmed = stemmed.slice(0, -2);
  else if (stemmed.endsWith('s') && !stemmed.endsWith('ss') && !stemmed.endsWith('us')) {
    stemmed = stemmed.slice(0, -1);
  }

  if (stemmed.endsWith('ing') && stemmed.length > 5) stemmed = stemmed.slice(0, -3);
  else if (stemmed.endsWith('ed') && stemmed.length > 4) stemmed = stemmed.slice(0, -2);

  // "cancelling" -> "cancell" -> "cancel"
  if (/(.)\1$/.test(stemmed) && stemmed.length > 3 && !/[aeiou]/.test(stemmed.slice(-1))) {
    stemmed = stemmed.slice(0, -1);
  }

  return stemmed;
}
