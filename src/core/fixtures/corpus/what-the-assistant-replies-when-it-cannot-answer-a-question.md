---
title: What the assistant replies when it cannot answer a question
keywords: don't know, no answer, cannot answer, unanswered question, won't guess, not covered, fallback message, miss, empty result, no information found, failure message, honest miss, what does it say when it has no answer
derived-from: src/core/answer.ts, src/core/index.ts, src/core/claudeEngine.ts, src/core/engine.ts, src/index.ts, src/core/answerFormat.test.ts, src/core/fixtures/corpus/what-the-bot-does-when-the-code-reading-service-is-unreachab.md
fingerprint: 54a07e42a0c1eb64
---

## Questions
- what does it say when it doesn't know the answer to my question?

## Short answer
When it cannot answer, it replies with a single short line: it does not have an answer to that yet, it will not guess at one, and nothing it knows covers it. No steps or edge cases are shown alongside it.

## What happens
1. You ask a question the assistant has no stored answer for.
2. It checks what it already knows and finds nothing that matches, including a second look at anything that came close.
3. It then reads the codebase to try to work out the answer fresh.
4. If that attempt produces nothing usable, it replies with the honest miss message: it does not have an answer to that yet, it will not guess at one, and nothing it knows covers it.
5. The reply appears under a short answer heading only, with no numbered steps and no edge case list.
6. Nothing is saved for a miss, so the same question asked later starts the same attempt over again.

## Edge cases
- The same wording is used for several different underlying situations: the question genuinely is not covered, the code-reading service was unreachable or not signed in, the analysis run did not finish, or the answer it produced was thrown away for being written in developer language instead of plain product language. From the asker's side these are indistinguishable; only the server log tells them apart.
- If the assistant is started without being pointed at a codebase, it can never fill gaps, so every question it has not already stored an answer for receives this same message. Previously stored answers are still served normally.
- A miss is not free. The codebase is still read before the assistant concludes it does not know, and that attempt is charged and recorded against the conversation just like a successful one.
- If you flag a previous answer as wrong and the code cannot be read again, you get a different message instead: it could not read the code just now, it has left the answer as it was, and flagging it again in a little while will retry.
- If you flag the same answer twice within a short cooling-off period, it says it read the code for that one very recently so it has not read it again, and notes that a developer can correct the stored entry directly.
- If a stored answer's underlying code has changed and it could not be checked again, you are not given a miss. You get the old answer prefixed with a warning that it may be out of date.
