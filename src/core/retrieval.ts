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
 * What it takes to answer on lexical evidence alone, without a second opinion.
 *
 * These are deliberately high. Measured against a twelve-entry corpus of real
 * entries this bot wrote, the previous bars (score 1.0, coverage 0.34, no
 * margin) served a wrong entry for three of ten rephrasings and answered two of
 * seven entirely unrelated questions. Worse, the whole range from 0.5 to 2.0
 * behaved almost identically -- an absolute score cannot discriminate, because
 * it grows with the corpus and with the rarity of the words involved.
 *
 * The margin is what actually separates a confident match from a lucky one. A
 * wrong top-ranked entry beat its runner-up by 1.04x and 1.09x; a right one by
 * 2.2x to 2.6x.
 *
 * At these three, nothing wrong was served and nothing unrelated was answered,
 * and in every case that fell short the correct entry was still inside the
 * shortlist handed to the judge. Retrieval shortlists; the judge decides.
 */
/**
 * At or below this many entries, a lexical score carries very little. Words are
 * shared by most of the corpus, so inverse document frequency has almost
 * nothing to distinguish, and a question that matches nothing may simply be one
 * the statistics cannot see. A second opinion on the whole knowledge base is
 * cheap at this size and far cheaper than deriving an answer that already
 * exists, so nothing is written off on lexical evidence alone.
 */
const TOO_SMALL_TO_JUDGE_LEXICALLY = 5;

const MIN_SCORE = 4.0;
const MIN_COVERAGE = 0.75;
const MIN_MARGIN = 2.0;

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

  /**
   * The top-ranked entry, and whether it is far enough ahead of the next one to
   * be trusted without asking anybody.
   */
  function decide(question: string): { served?: Match; ranked: Match[] } {
    const ranked = rank(question);
    const top = ranked[0];
    if (!top) return { ranked };

    // Nothing else scored at all, so there is nothing it could be confused with.
    const runnerUp = ranked[1]?.score ?? 0;
    const margin = runnerUp === 0 ? Infinity : top.score / runnerUp;

    const confident =
      top.score >= MIN_SCORE && top.coverage >= MIN_COVERAGE && margin >= MIN_MARGIN;
    return confident ? { served: top, ranked } : { ranked };
  }

  return {
    rank,
    best(question: string): Match | undefined {
      return decide(question).served;
    },

    candidates(question: string, limit = 5): Match[] {
      const { served, ranked } = decide(question);

      // Something was confident enough to answer with; nobody needs asking.
      if (served) return [];

      // Everything that scored, best first. These are not near misses in the
      // old sense of "almost cleared a bar" -- the bars are now high enough
      // that most real matches land here, and the judge is what turns a
      // shortlist into an answer.
      if (ranked.length > 0) return ranked.slice(0, limit);

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
