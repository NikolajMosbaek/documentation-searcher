---
title: Choosing between a saved answer and reading the codebase
keywords: search the code, answer from memory, saved answers, when does it search, reuse previous answer, keyword match, cached answer, reads the codebase, don't know, first asker second asker
derived-from: src/index.ts, src/core/index.ts, src/core/knowledgeBase.ts, src/core/claudeEngine.ts, src/core/engine.ts, src/core/answer.ts, src/core/threadContext.ts
---

## Short answer
For every question the bot first looks through its store of previously saved answers, matching the question's wording against the keywords recorded on each saved answer. Only when nothing matches does it go and read the codebase, and if it finds an answer there it saves it so the next person asking gets the stored version instead.

## What happens
1. A question arrives in a chat and the bot shows a typing indicator while it works.
2. The bot compares the question against every saved answer it holds. Each saved answer carries a list of keywords, and it counts how many of those keywords appear anywhere in the question text.
3. Saved answers with no keyword match at all are discarded; among the rest, the one with the most matching keywords wins.
4. If there is a winner, the bot replies with that saved answer straight away and never looks at the codebase for that question.
5. If nothing matches, the bot reads the codebase itself. It can only open, search and list files, never change them, and it works within a limit on how many steps and how much money one question may cost.
6. If the reading produces an answer, the bot replies with it and also files it away as a new saved answer, so the same question from the next person is answered from the store rather than by reading again.
7. If the reading produces nothing usable, the bot replies that it does not have an answer and will not guess.

## Edge cases
- If no codebase has been pointed at the installation, the bot skips reading entirely and every unmatched question gets the honest no-answer reply.
- Matching is literal: the keyword has to appear in the question as written. Asking the same thing in different words can miss the stored answer and trigger a fresh read of the codebase.
- The bot keeps a record of earlier questions in the same conversation, but that history does not currently influence whether it searches or reuses an answer; each question is judged on its own wording.
- When the reading finishes but the bot could not actually find the behaviour in the code, that counts as no answer rather than a partial one, and nothing is saved.
- If a freshly derived answer still contains code-like wording such as file names or code snippets, it is thrown away rather than shown or saved, and the asker gets the no-answer reply.
- If the reading runs out of its step or cost allowance, or the analysis service cannot be reached or is not signed in, that is treated as simply not knowing rather than as an error, and no failure message or technical detail reaches the asker.
- A newly saved answer becomes findable immediately, without a restart.
- Saving a new answer never overwrites an existing one; a new file is created alongside. If saving fails for any reason, the asker still gets the answer.
- Saved answers that are malformed are skipped when the bot starts up, so they can never be matched, and any that read like code rather than plain product language are flagged at that point.
