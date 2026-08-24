---
title: What the bot does when the code-reading service is unreachable
question: What does the bot do when it cannot reach the service that reads the code?
keywords: service unavailable, cannot reach the service, analysis engine down, outage, connection failure, unauthenticated, error handling, no answer, honest miss, graceful degradation, stale answer, offline, failure, budget exceeded, crash, stack trace
derived-from: README.md, src/index.ts, src/core/index.ts, src/core/claudeEngine.ts, src/core/engine.ts, src/core/answer.ts
fingerprint: 8fc79da59fc75d80
---

## Short answer
When the bot cannot reach the service that reads the code, it does not crash or show an error — it treats the failure as simply not knowing, and replies that it does not have an answer yet and will not guess at one. If it already has a stored answer for the question, it still serves that, adding a visible warning when the code behind it has changed since it was written.

## What happens
1. The bot receives a question and first looks for a stored answer that covers it.
2. If a stored answer exists and the code it was based on has not changed, the bot serves it immediately without contacting the code-reading service at all, so the outage has no effect on that question.
3. If there is no stored answer, or the stored one no longer matches the current code, the bot tries to reach the code-reading service to work the answer out from the code.
4. When that attempt fails because the service is unreachable or the credentials are not accepted, the failure is caught rather than allowed to surface to the asker.
5. A warning describing the failure is written to the server log for whoever runs the bot; the asker never sees it.
6. Internally the attempt is recorded as having produced no answer, exactly as if the codebase genuinely did not cover the question.
7. For a question with no stored answer, the bot replies that it does not have an answer to that yet, that it will not guess at one, and that nothing it knows covers it.
8. Nothing is added to the stored knowledge as a result of the failed attempt, so a later attempt starts fresh.
9. The asker always receives a reply, and the bot keeps running and continues answering other questions from stored knowledge.

## Edge cases
- If a stored answer exists but the code behind it has changed, and the service cannot be reached to check it again, the bot still hands over the old answer rather than withholding it — but prefixes it with a note saying the code has changed since the answer was written, that it could not be checked just now, and that it should be treated as possibly out of date.
- A failed attempt is indistinguishable to the asker from a question the codebase genuinely does not cover: both produce the same 'I don't know and won't guess' reply. Only the server log tells the two apart.
- The same outcome occurs when the attempt reaches the service but does not finish successfully — for example when it runs past the spending ceiling or the limit on how much work one question may take. Setting the spending ceiling too low will cut off real questions and make them look like misses.
- If the attempt succeeds but the answer comes back written in code language rather than product language, the answer is thrown away instead of stored or shown, and the asker again gets the honest 'I don't know' reply.
- If the bot is started without being told which codebase to answer about, it announces once at startup that it cannot fill gaps, and then behaves as though the service is permanently unreachable: stored answers are still served, but every question it has not seen before gets the 'I don't know' reply.
- Without a configured codebase the bot also cannot tell whether a stored answer is out of date, so stored answers are served as written with no staleness warning.
- Hand-written answers are never treated as out of date, so the bot never tries to reach the service to re-check them and an outage cannot affect them.
