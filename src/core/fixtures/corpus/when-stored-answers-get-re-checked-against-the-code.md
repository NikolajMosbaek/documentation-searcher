---
title: When stored answers get re-checked against the code
keywords: re-check answers, on a schedule, scheduled rebuild, background job, cron, nightly refresh, stale answer, out of date answer, verify on read, when does an answer update, does it run automatically, code changed since the answer was written, commit hook, refresh trigger
derived-from: PRD.md, src/index.ts, src/core/index.ts, src/core/sourceIndex.ts, src/core/knowledgeBase.ts, src/core/engine.ts, src/core/answer.ts
fingerprint: b154f3bb24ac822c
---

## Questions
- does it re-check its answers on a schedule, or only when someone asks?

## Short answer
Only when someone asks. A stored answer is checked against the current state of the code at the moment a question reaches it; nothing runs on a timer or a schedule, so an answer nobody asks about is never re-checked.

## What happens
1. Someone asks a question in the chat thread.
2. The bot looks through the answers it has already written for one that covers the question.
3. If it finds one, it compares the parts of the codebase that answer was written from against how those parts look right now.
4. If nothing has changed, the stored answer is sent back straight away, with no re-reading and no extra cost.
5. If something has changed, the bot reads the codebase again, rewrites the stored answer with what it now finds, and replies with the fresh version.
6. Nothing else sets this comparison off. There is no timer, no nightly run, no background job, and no check that fires when code is committed.

## Edge cases
- An answer nobody asks about is never re-checked, however much the code underneath it changes in the meantime.
- Answers written by hand by a developer are never treated as out of date and are never re-checked automatically, because a person wrote them deliberately and owns them.
- If no codebase is connected to the install, there is nothing to compare answers against, so stored answers are always served exactly as written.
- If the code has changed but the bot cannot read the codebase again at that moment, it still gives the stored answer but adds a visible warning that it may be out of date.
- Flagging an answer as wrong in the thread also triggers a fresh read of the code. That is a second way a re-check happens, and it is still a person asking, not a schedule.
- Repeated flagging of the same answer within a few minutes does not read the code again; the bot says it checked very recently and suggests a developer correct the entry directly.
- When no stored answer covers the question at all, the bot reads the codebase and writes a new answer, so that the next person asking gets it instantly.
