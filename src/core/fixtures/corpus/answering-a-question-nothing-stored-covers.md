---
title: Answering a question nothing has been stored for
question: What happens when someone asks a question the bot has no stored answer for?
keywords: no stored answer, unknown question, miss, first time a question is asked, bot does not know, reads the codebase, new question, gap in the knowledge, question not covered, won't guess, fills a miss, cold question, fresh answer, saves the answer for next time
derived-from: README.md, src/index.ts, src/core/index.ts, src/core/answer.ts, src/core/engine.ts, src/core/claudeEngine.ts, src/core/knowledgeBase.ts, src/core/retrieval.ts, src/core/judge.ts
fingerprint: afd726d02dfaf340
---

## Short answer
When nothing stored covers the question, the bot reads the codebase itself, answers from what it finds, and saves that answer so the next person asking gets it instantly and for free. If it cannot produce an answer, it says plainly that it does not know and refuses to guess.

## What happens
1. The question arrives in a chat thread. If it is not the first message in the thread and it leans on what was said before, it is first rewritten into a question that stands on its own, so everything after this point works on a question that means something by itself.
2. The bot looks for a stored answer. Asking the exact question that originally paid for an entry always finds it again; otherwise a word-based search must clear both a relevance bar and a bar for how much of the question's wording the entry covers.
3. If nothing clears those bars but some stored entries share at least some vocabulary with the question, those near misses are handed to a quick second opinion that decides whether any of them genuinely answers the question. That takes a few seconds and costs cents rather than a dollar.
4. If the second opinion picks one, that stored answer is served and nothing is read. If it picks none, that is recorded, because those are exactly the cases where money is about to be spent on something the stored answers may already have held.
5. With nothing stored and nothing rescued, the bot reads the codebase directly, with read-only access and no ability to change anything. This is the expensive step: roughly forty seconds to a minute, and observed at somewhere between about sixty cents and a dollar and fifteen per question.
6. The reading produces a structured result: a short answer, ordered steps describing what happens, and edge cases, all written in everyday product language rather than in code terms.
7. The new answer is saved as its own entry, recording the exact question that was asked, lookup words, which parts of the codebase it came from, and a snapshot of those parts so staleness can be detected later.
8. The answer is sent back to the asker, and every future asker of the same question gets it from storage in about a millisecond at no cost.
9. Each read of the codebase is logged with what it cost, why it happened, and a running total for the session.

## Edge cases
- If no codebase has been configured for the install, the bot never fills a gap at all. It still answers from what is already stored, warns about this once when it starts up, and replies to anything else with the honest miss message.
- If the analysis cannot run — unreachable, not authenticated, interrupted, or it hits its spending ceiling for a single question — the asker gets the same honest miss message rather than an error or a stack trace.
- If the codebase genuinely does not cover the question, the bot is instructed to answer nothing rather than describe what the code probably does. The asker gets the miss message and nothing is stored.
- If the freshly produced answer leaks code detail — file names, function calls, code formatting — it is thrown away rather than stored, and the asker gets the miss message. A stored entry is served to everyone who asks next, so a leak there is treated as worse than a miss.
- If the answer is produced but saving it fails, the asker still gets the answer; only the storing is lost, so the next person asking the same thing pays for it again.
- A stored answer is never overwritten by accident: a new entry whose name collides with an existing one is given a distinct name instead.
- A question that shares no wording at all with anything stored skips the second opinion entirely — there is nothing to weigh — and goes straight to reading the codebase. This is the known blind spot: a question phrased with entirely different vocabulary from the entry that answers it will not be found.
- A confident stored match is never second-guessed by the extra opinion.
- The second opinion is deliberately cautious and is told to choose nothing when in doubt, because a wrong rescue answers a question nobody asked, while a wrong refusal only costs the reading that would have happened anyway.
- The miss reply is deliberately worded as not knowing rather than as a failure: nothing in what the bot knows covers it, and it will not guess.
