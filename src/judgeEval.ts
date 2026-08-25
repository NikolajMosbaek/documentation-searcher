import { join } from 'node:path';
import { createClaudeJudge, createKnowledgeBase } from './core/index.js';
import { CORPUS_DIRECTORY, REPHRASINGS, UNRELATED } from './core/fixtures/labelledQuestions.js';

/**
 * Measures the second opinion, which `npm test` cannot: it needs a real model.
 *
 * Since iteration 19 retrieval shortlists rather than decides, so the judge is
 * what turns most questions into answers. Its accuracy had never been measured
 * against anything larger than five questions. This runs the same labelled set
 * the hermetic evaluation uses, against a real model, for about thirty cents.
 *
 * The number that matters is the last one. A judge that declines too often
 * costs a derivation; a judge that accepts wrongly answers a question nobody
 * asked, silently, to everyone who asks it afterwards.
 */
const CORPUS = process.env.DOCSEARCHER_KNOWLEDGE_BASE ?? join(process.cwd(), CORPUS_DIRECTORY);

const knowledgeBase = createKnowledgeBase(CORPUS);
const judge = createClaudeJudge({
  model: process.env.DOCSEARCHER_JUDGE_MODEL ?? process.env.DOCSEARCHER_MODEL,
  cwd: process.cwd(),
});

console.log(`Weighing ${REPHRASINGS.length + UNRELATED.length} questions against ${knowledgeBase.size} entries.`);
console.log('A model call each, so this costs cents rather than nothing.\n');

let servedDirectly = 0;
let rescued = 0;
let pickedWrong = 0;
let declinedWhenItShouldNot = 0;
let neverAsked = 0;
let declinedCorrectly = 0;
let answeredWrongly = 0;

for (const [question, acceptable] of REPHRASINGS) {
  // The exact question is the only thing answered without asking anybody, and
  // none of these are phrased that way.
  const exact = knowledgeBase.find(question);
  if (exact) {
    servedDirectly += 1;
    console.log(`exact match  ${question}`);
    continue;
  }

  const chosen = await judge.choose(question, knowledgeBase.candidates(question));
  if (!chosen) {
    declinedWhenItShouldNot += 1;
    console.log(`DECLINED    ${question}`);
  } else if (acceptable.includes(chosen.file)) {
    rescued += 1;
    console.log(`rescued     ${question}`);
  } else {
    pickedWrong += 1;
    console.log(`WRONG ENTRY ${question}  -> ${chosen.file}`);
  }
}

for (const question of UNRELATED) {
  const shortlist = knowledgeBase.candidates(question);
  if (shortlist.length === 0) {
    neverAsked += 1;
    console.log(`not even close         ${question}`);
    continue;
  }
  const chosen = await judge.choose(question, shortlist);
  if (chosen) {
    answeredWrongly += 1;
    console.log(`ANSWERED WRONGLY       ${question}  -> ${chosen.file}`);
  } else {
    declinedCorrectly += 1;
    console.log(`declined               ${question}`);
  }
}

console.log(`\nQuestions the knowledge base answers (${REPHRASINGS.length}):`);
console.log(`  answered by exact wording  : ${servedDirectly}`);
console.log(`  rescued by the judge       : ${rescued}`);
console.log(`  wrong entry chosen         : ${pickedWrong}`);
console.log(`  declined, so pays to derive: ${declinedWhenItShouldNot}`);
console.log(`Questions it does not (${UNRELATED.length}):`);
console.log(`  never reached the judge    : ${neverAsked}`);
console.log(`  correctly declined         : ${declinedCorrectly}`);
console.log(`  ANSWERED WRONGLY           : ${answeredWrongly}`);

const wrong = pickedWrong + answeredWrongly;
console.log(`\n${wrong === 0 ? 'Nothing was answered from an entry that does not answer it.' : `${wrong} question(s) answered wrongly.`}`);
process.exit(wrong === 0 ? 0 : 1);
