---
title: What happens when a stored answer is out of date
question: What happens when a stored answer is out of date?
keywords: out of date, outdated answer, stale answer, refresh, re-derive, verify on read, code changed, cached answer, saved answer, knowledge base entry, possibly out of date warning, re-check
derived-from: src/core/index.ts, src/core/sourceIndex.ts, src/core/knowledgeBase.ts, src/core/answer.ts, src/core/engine.ts, src/core/claudeEngine.ts, README.md
fingerprint: 9a41169d9d58eb99
---

## Short answer
Every time a stored answer is about to be used, the assistant checks whether the parts of the codebase it was based on have changed. If they have, it works the answer out again from the current code and replaces the stored one; if it cannot do that right then, it still gives you the old answer, but labelled as possibly out of date.

## What happens
1. Someone asks a question and the assistant finds a matching stored answer.
2. Before handing it over, the assistant compares the parts of the codebase the answer was originally based on with how those parts look now. It compares the actual content rather than dates, so the check works the same on any machine and after any fresh checkout.
3. If nothing has changed, the stored answer is returned straight away.
4. If something has changed, the stored answer is not trusted. The assistant reads the codebase again and works out a fresh answer to the same question.
5. If that succeeds, the stored entry is updated in place with the new answer, title, keywords and record of what it was based on, and the fresh answer is given to the asker. The wording of the question that originally created the entry is kept, so whoever asked it that way is still guaranteed to find it again.
6. If a fresh answer cannot be produced, the asker still gets the old one, but it opens with a note saying the code behind it has changed, that it could not be checked again just now, and that it should be treated as possibly out of date. A warning is also recorded for whoever runs the service.

## Edge cases
- The check happens only because someone asked. There is no scheduled rebuild, background job or repository hook that refreshes answers on its own.
- Answers written by hand are never treated as out of date. They carry no record of which code they came from, so they are always served as written, on the basis that a person wrote them deliberately and owns them.
- If no codebase is configured for the installation, no staleness check is possible and stored answers are served as they are; questions with no stored answer simply come back as an honest miss.
- Deleting the code an answer was based on counts as a change, so the answer is treated as out of date rather than still fresh. The same applies if the recorded location points somewhere outside the codebase.
- A refresh costs the same time and money as answering a brand new question, roughly a minute and about a dollar, whereas serving an unchanged stored answer is effectively instant and free.
- A refresh is treated as failed, and the old answer served with the warning, whenever the fresh attempt cannot complete: the analysis service being unreachable, hitting its spending or step limits, deciding the behaviour is not in the code, or producing an answer that reads like code rather than plain product language.
- If a fresh answer is produced but cannot be written back to storage, the asker still gets the fresh answer; only an internal warning is recorded, and the next asker will trigger the same refresh again.
- A refresh can be triggered by a differently worded question that was matched to the entry; the entry is still rewritten, but the original question it was stored under is preserved rather than overwritten.
