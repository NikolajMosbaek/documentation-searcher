---
title: Refreshing a stored answer when the code behind it has changed
question: What happens when a stored answer is out of date?
keywords: out of date, stale answer, outdated, refresh, re-check, verify on read, code changed, stored answer, cached answer, knowledge base entry, possibly out of date warning, re-derive, staleness, fingerprint check
derived-from: README.md, src/core/index.ts, src/core/knowledgeBase.ts, src/core/sourceIndex.ts, src/core/answer.ts, src/core/engine.ts, src/core/claudeEngine.ts
fingerprint: 6bf93713d20dd4bf
---

## Short answer
Before serving a stored answer, the bot checks whether the parts of the codebase that answer was written from still look the same. If they have changed, it works the answer out again from the current code, saves the new version over the old one, and gives the asker the fresh answer. If it cannot work it out again, it still gives the old answer, but labelled as possibly out of date.

## What happens
1. Someone asks a question and the bot finds a stored answer that covers it.
2. Before handing that answer over, the bot re-reads the parts of the codebase the answer was originally written from and compares their current content with a snapshot recorded when the answer was stored.
3. If the content is unchanged, the stored answer is served immediately - the fast, free path.
4. If the content has changed, the stored answer is not trusted. The bot reads the codebase again and works out a fresh answer to the same question.
5. When that succeeds, the fresh answer replaces the old one in the same stored entry, keeping the same place in storage and recording a new snapshot of the code it was just read from, so a reviewer sees an update rather than an unrelated deletion and addition.
6. The asker receives the freshly worked-out answer, and everyone who asks afterwards gets it instantly from storage until the code moves again.
7. When a fresh answer cannot be produced, the bot serves the old stored answer with a note at the top saying the code behind it has changed, it could not be checked again just now, and it should be treated as possibly out of date. A warning is also recorded for whoever runs the bot.

## Edge cases
- The check happens only because someone asked. There is no scheduled rebuild and no check triggered by code being committed, so an answer nobody asks about is never re-worked.
- Hand-written answers are never treated as out of date. An answer with no record of which code it came from, or no stored snapshot of that code, is always served as-is, on the basis that a person wrote it deliberately and owns it.
- If no codebase is configured for the install, no answer is ever checked for staleness and stored answers are always served as-is. In that state a fresh answer can never be produced either, so an answer that has gone out of date would still be served without any warning.
- Comparison is by file content, not by modification date, so checking out the same code on a different machine or at a different time does not falsely flag an answer as out of date.
- If a file the answer came from has been deleted, renamed, or now sits outside the codebase, that counts as a change, so the answer is treated as out of date rather than staying silently fresh.
- Reworking an answer takes real time and money - roughly forty to fifty-five seconds and about a dollar - compared with roughly a millisecond and nothing for serving a stored one, so a question asked right after the code moves is noticeably slower.
- Re-working can fail for several reasons: the analysis service being unreachable or not signed in, the run hitting its spend ceiling or turn limit, the analysis concluding it cannot answer from the code, or the new wording leaking code detail such as file names or backticks. All of these lead to the old answer being served with the out-of-date note.
- If the refreshed answer is produced but cannot be written back to storage, the asker still gets the fresh answer; the stored copy stays as it was, so the next asker triggers the same re-work again.
- An answer file that has become unreadable or malformed is skipped with a warning rather than taking the whole store down, which means the question it covered behaves as if nothing is stored for it.
