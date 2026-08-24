/**
 * Guided seeding: the bot proposes what is worth documenting, a developer
 * chooses, and only then is anything written.
 *
 * The PRD is specific that this produces "a reviewed baseline rather than an
 * unattended bulk index", so the choosing step is not optional and cannot be
 * skipped by passing a flag. The plan is a file because the knowledge base is
 * a file: editing a checklist and reviewing a diff are the same motion a
 * developer already uses for everything else here.
 */
export interface Area {
  title: string;
  /** Why this area is worth documenting before the others. */
  why: string;
  /** Questions an asker would actually ask about it, in their words. */
  questions: string[];
  /** Whether a developer has chosen it. Everything is proposed unchosen. */
  chosen: boolean;
}

export interface AreaProposer {
  /** Read the codebase and propose areas worth documenting first. */
  propose(limit: number): Promise<Area[]>;
}

const PREAMBLE = `Proposed by reading the codebase. Nothing here has been written yet.

Tick an area to have it documented, edit or delete any question you do not want
asked, then run \`npm run seed -- --write\`.

Each question is answered by reading the codebase, which takes about a minute and
costs roughly one US dollar. Ticking everything is rarely the right move; the
point of this file is to choose.

Entries are written as files, so what the bot produces is reviewed the same way
as any other change.`;

export function formatSeedPlan(areas: Area[]): string {
  const lines = ['# Seeding plan', '', PREAMBLE, ''];

  for (const area of areas) {
    lines.push(`## [${area.chosen ? 'x' : ' '}] ${oneLine(area.title)}`, '');
    lines.push(`Why: ${oneLine(area.why)}`, '');
    for (const question of area.questions) lines.push(`- ${oneLine(question)}`);
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * Forgiving on purpose. A developer edits this by hand, and a plan that fails
 * to parse because a blank line moved would be a bad way to learn that.
 */
export function parseSeedPlan(raw: string): Area[] {
  const areas: Area[] = [];
  let current: Area | undefined;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    const heading = /^##\s*\[([ xX]?)\]\s*(.+)$/.exec(trimmed);
    if (heading) {
      current = {
        title: heading[2]!.trim(),
        why: '',
        questions: [],
        chosen: heading[1]!.toLowerCase() === 'x',
      };
      areas.push(current);
      continue;
    }

    if (!current) continue;

    const why = /^why:\s*(.+)$/i.exec(trimmed);
    if (why) {
      current.why = why[1]!.trim();
      continue;
    }

    const question = /^[-*]\s+(.+)$/.exec(trimmed);
    if (question) current.questions.push(question[1]!.trim());
  }

  return areas;
}

/** What `--write` will actually do, so it can be reported before it is done. */
export function chosenQuestions(areas: Area[]): string[] {
  return areas
    .filter((area) => area.chosen)
    .flatMap((area) => area.questions)
    .map(oneLine)
    .filter(Boolean);
}

/**
 * What answering a number of questions is likely to cost, in US dollars.
 *
 * The bounds are measured rather than assumed: individual answers derived
 * during development ranged from about $0.60 to about $1.15, depending on how
 * much of the codebase had to be read. A larger or less commented codebase
 * will cost more, so this is a floor to plan against and not a quote.
 */
export function estimateCostUsd(questions: number): { low: number; high: number } {
  return { low: questions * 0.6, high: questions * 1.15 };
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
