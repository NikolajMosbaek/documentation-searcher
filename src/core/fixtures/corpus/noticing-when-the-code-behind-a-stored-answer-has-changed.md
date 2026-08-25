---
title: Noticing when the code behind a stored answer has changed
keywords: stale answer, out of date, outdated answer, verify on read, staleness check, refresh a stored answer, re-derive, code changed, freshness, knowledge base entry, hand-written entry, signature of the code, content comparison, silently outdated
derived-from: src/core/index.ts, src/core/sourceIndex.ts, src/core/knowledgeBase.ts, src/core/engine.ts, src/core/claudeEngine.ts, src/core/answer.ts, PRD.md
fingerprint: f8d73d87b3d71a03
---

## Questions
- how does the bot know when the code behind an answer has changed?

## Short answer
When the bot writes an answer from the codebase, it records which parts of the codebase it read and a compact signature of the exact content of those parts. Before serving that stored answer again it re-takes the signature and compares it with the saved one; if they differ, the code has changed and the answer is re-derived before anyone sees it.

## What happens
1. When the bot answers by reading the codebase, it records the parts of the codebase it actually read and computes a compact signature over the exact content of those parts at that moment.
2. Both the list of parts read and that signature are saved alongside the stored answer as background information that is never shown to an asker.
3. On a later question, the bot first looks for a stored answer that covers it.
4. When it finds one, it re-computes the signature over the same recorded parts as they exist right now, and compares it with the signature saved when the answer was written.
5. If the two match, the code has not changed and the stored answer is served straight back with no further work.
6. If they differ, the answer is treated as out of date: the bot reads the codebase again, replaces the stored answer in place, and serves the freshly derived answer instead.

## Edge cases
- The comparison is based on the content of the code, not on when it was last modified. Stored answers travel with the code to machines that never saw the original write, where modification dates would say nothing useful.
- The parts read are sorted and de-duplicated before the signature is taken, so the same set of code always produces the same signature no matter what order it was reported in.
- Code that has been deleted, or that cannot be read, contributes a distinct fixed value, so removing the code an answer describes registers as a change rather than leaving the answer looking fresh.
- If a recorded part points outside the codebase the bot is bound to, it is treated as absent rather than followed.
- An answer written by hand by a developer carries no signature and is never called out of date; the developer wrote it deliberately and owns it.
- An answer with no recorded parts of the codebase behind it is never called out of date either, because there is nothing to compare.
- If no codebase is configured for the deployment, no stored answer can be checked for staleness at all and stored answers are served as they are.
- If the code has changed but the re-read fails, the stored answer is still given, prefixed with a visible note that the code behind it has changed and it may be out of date.
- Re-deriving an answer costs money and is recorded as spend against the conversation that triggered it, whether or not it produces a new answer.
- When an answer is refreshed, every phrasing of a question already known to reach that entry keeps reaching it, and the refreshed text replaces the old one in the same entry.
