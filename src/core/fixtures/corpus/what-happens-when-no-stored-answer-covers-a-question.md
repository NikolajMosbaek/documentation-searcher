---
title: Answering a question that has no stored answer yet
question: What happens when someone asks a question the bot has no stored answer for?
keywords: no stored answer, miss, unknown question, asked for the first time, not in the knowledge base, bot doesn't know, new question, honest miss, i don't have an answer, writes a new entry, reads the codebase, cost of a new question
derived-from: src/core/index.ts, src/core/answer.ts, src/core/engine.ts, src/core/claudeEngine.ts, src/core/knowledgeBase.ts, src/core/retrieval.ts, src/core/judge.ts, src/index.ts, PRD.md
fingerprint: 6e1389513771a8cc
---

## Short answer
When nothing stored covers the question, the bot reads the codebase itself to work the answer out, saves what it learns so the same question is never paid for twice, and replies with the new answer. If the codebase genuinely does not cover the question, or the reading cannot be done, it says plainly that it has no answer and will not guess.

## What happens
1. The bot first looks in what it already has stored. Someone asking in exactly the same words as a previous asker is guaranteed to get that stored answer back; otherwise it searches on the words in the question.
2. If nothing matches confidently but a few stored entries share some vocabulary with the question, the bot takes a cheap second look and asks whether one of them really does answer it. If one does, that stored answer is served and nothing further is spent.
3. If there is still no answer, the bot reads the codebase itself. It only reads, never changes anything, and works out the behaviour from what the code actually does.
4. When it finds the behaviour, it writes a new knowledge-base entry: a title in everyday language, the question as it was asked, lookup words, and a private record of which parts of the code the answer came from.
5. The new entry becomes findable straight away, so the next person to ask the same thing gets an instant reply at no further cost.
6. The asker receives the answer in the usual shape: a short direct answer, then the behaviour as numbered steps, then the edge cases and conditions.
7. What that reading cost is logged along with a running total for the session, so the spend is visible rather than hidden.

## Edge cases
- If the codebase does not cover the question, the reply is that the bot has no answer to that yet and will not guess at one. No steps or edge cases are shown, and nothing is stored.
- If no codebase has been configured for the installation, every unanswered question falls back to that same honest reply, and the bot logs at startup that misses cannot be filled.
- If the reading cannot be completed at all — the analysis is unreachable, not signed in, hits its spending ceiling, or does not finish — the asker gets the same honest reply rather than an error or a stack trace.
- If the answer that comes back contains code detail such as file names, technical names, or code fragments, it is thrown away rather than stored or shown, and the asker gets the honest reply instead. A leaked answer would otherwise be served to everyone who asks afterwards.
- If the answer is found but cannot be saved, the asker still gets the full answer. It simply is not stored, so the next person asking the same thing will trigger the reading again.
- A new entry never overwrites an existing one. If the title collides with a file already there, a separate file is created alongside it.
- If the question is a follow-up in an ongoing thread and leans on what was said earlier, it is first rewritten into a standalone question, and it is that standalone question that gets looked up, answered, and stored.
- The entry is stored under the question as the asker phrased it, not as the analysis rephrased it, so the person who paid for the answer is certain to find it again.
- A completely unreadable or badly formatted stored entry is skipped at startup with a warning rather than taking the whole knowledge base down, so questions it would have answered become misses.
