---
title: Answers never contain file names or code
keywords: file names in answers, code in answers, technical jargon, product language, no code references, plain language, file paths, function names, code snippets, non-technical answers, readable answers, jargon leaking into answers
derived-from: PRD.md, src/core/answer.ts, src/core/answerFormat.test.ts, src/core/claudeEngine.ts, src/core/knowledgeBase.ts, src/core/index.ts, src/index.ts, src/seed.ts, src/core/seeding.ts, src/docs.test.ts
fingerprint: ede97c557cd4cf34
---

## Questions
- will it ever give me file names or code in an answer?

## Short answer
No. Answers are written in product language only, and any answer freshly worked out from the codebase is thrown away completely if it contains something that looks like a file name, a code call, or a snippet. The record of which files an answer came from is kept internally for staleness checks and is never shown to you.

## What happens
1. When the assistant reads the codebase to work out an answer, it is explicitly instructed to describe behaviour the way someone using the product would describe it, and to avoid file paths, folder names, file extensions, function, class, type and variable names, code snippets, and line numbers.
2. If it cannot express something without naming code, it is instructed to say it more plainly or leave it out.
3. Before anything is kept, every sentence of the short answer, the steps, and the edge cases is checked against a code-shape detector.
4. If any part of a freshly derived answer looks like code, the entire answer is discarded rather than cleaned up or stored, a warning goes to the operator log, and you are told plainly that there is no answer yet.
5. Only an answer that passes the check is saved and sent back to you.
6. What arrives in the chat is only the short answer, the numbered steps, and the edge cases. The internal note of which files the answer was derived from, and which stored entry answered, is used for staleness and correction handling and is never part of the reply.

## Edge cases
- The automatic detector only catches obvious shapes: a name ending in one of the common programming file extensions, a dotted call with brackets after it, and anything wrapped in backticks. A bare class or function name, a folder path with no extension, or an uncommon file type would slip past it.
- Entries written or edited by hand by a developer are not blocked. If one of those reads like code, a warning is written to the operator log at startup, but the entry is still loaded and can still be served to you.
- Entries produced during initial setup, when a developer picks areas to document ahead of time, go through the same discard rule as any other machine-written answer.
- When an answer is discarded for reading like code, you get the honest no-answer reply rather than a partially cleaned version, and nothing is stored, so the same question would have to be worked out again from scratch.
- Some replies mention in plain words that an entry is a file in the repository that a developer can correct, but no file is ever named.
- The notices attached to an answer that is possibly out of date, or that has just been re-read after being flagged, contain no code detail either.
