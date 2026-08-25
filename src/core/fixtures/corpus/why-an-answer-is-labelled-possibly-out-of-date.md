---
title: Why an answer is labelled possibly out of date
keywords: possibly out of date, out of date warning, stale answer, code has changed, could not be checked again, saved answer, stored answer, refresh failed, re-check on read, why does my answer have a warning, notice at the top of an answer, cached answer
derived-from: src/core/index.ts, src/core/answer.ts, src/core/sourceIndex.ts, src/core/knowledgeBase.ts, src/core/engine.ts, src/core/claudeEngine.ts, src/index.ts, src/core/fixtures/corpus/what-happens-when-a-stored-answer-is-out-of-date.md
fingerprint: bdd288e48dfe47c3
---

## Questions
- why does my answer say it might be out of date?

## Short answer
The answer you were given was a saved one, and the parts of the codebase it was originally based on have changed since it was written. The assistant tried to work the answer out again from the current code, that attempt did not succeed, so it handed over the older answer with a note instead of passing it off as still current.

## What happens
1. You ask a question and the assistant finds a saved answer that matches it.
2. Before handing it over, the assistant compares the parts of the codebase that answer was built from against how those parts look right now. It compares the actual content rather than dates, so the check behaves the same on any machine and after any fresh checkout.
3. If nothing has changed, the saved answer is returned straight away with no warning.
4. If something has changed, the saved answer is no longer trusted on its own. The assistant reads the codebase again and tries to work out a fresh answer to the same question.
5. If that fresh attempt succeeds, the saved entry is rewritten in place and you get the new answer, again with no warning.
6. If the fresh attempt does not succeed, you still get the older answer, but it opens with a line saying the code behind it has changed, that it could not be checked again just now, and that it should be treated as possibly out of date. A warning is also recorded for whoever runs the service.

## Edge cases
- Hand-written answers never carry this warning. They hold no record of which code they came from, so there is nothing to compare, and they are always served exactly as written on the basis that a person wrote them deliberately.
- If no codebase is configured for the installation, no change check happens at all and saved answers are served as they are, so the warning cannot appear.
- The re-read is counted as failed, and the warning shown, whenever the fresh attempt cannot complete: the analysis service being unreachable or unauthenticated, hitting its spending or step limits, concluding the behaviour is not actually in the code, or producing an answer that reads like code rather than plain product language.
- Deleting the code an answer was based on counts as a change, so the answer is treated as out of date rather than still fresh. The same applies if the recorded location points somewhere outside the codebase.
- The check only runs because someone asked. There is no scheduled rebuild or background job, so asking again later is what retries the refresh.
- If a fresh answer is produced but cannot be written back to storage, you still get the fresh answer with no warning; only an internal note is recorded, and the next person asking triggers the same re-read again.
- A re-read costs roughly the same time and money as answering a brand new question, whereas serving an unchanged saved answer is effectively instant and free.
- A differently worded question matched to the same saved answer can trigger the re-read; the entry is still rewritten, and the wording it was originally stored under keeps working.
- Two other notices exist and are not this one: flagging an answer as wrong that was just re-read says so plainly, and a failed re-read after flagging says the code could not be read again. Neither says the answer is out of date.
