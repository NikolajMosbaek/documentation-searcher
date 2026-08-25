---
title: Answers are the same for everyone, regardless of technical background
keywords: technical level, adapts to me, personalised answer, tailored answer, developer vs non-technical, plain language, jargon, audience, same answer for everyone, does it know who i am, answer style, reading level, expertise, simplify the answer, more detail for developers
derived-from: PRD.md, CONSTITUTION.md, src/index.ts, src/core/answer.ts, src/core/answerFormat.test.ts, src/core/claudeEngine.ts, src/core/threadContext.ts, src/core/fixtures/corpus/answers-never-contain-file-names-or-code.md
fingerprint: 8bdd592071257a35
---

## Questions
- does the bot answer differently depending on how technical I am?

## Short answer
No. The bot does not detect or adapt to how technical the asker is — every question gets the same answer shape, written in plain product language, no matter who asks.

## What happens
1. When you send a question in chat, only the text of the question and the conversation thread it belongs to are passed on. Nothing about you as a person — name, role, job title, or anything from outside that thread — is looked at.
2. The question is checked against the stored answers first. Matching happens purely on the words in the question, never on anything about the person asking.
3. If nothing stored covers it, the codebase is read to work the answer out, and the instructions used for that reading always describe the same audience: people who do not read code, such as product owners, testers and support staff.
4. Those same instructions always forbid file names, folder names, technical names, code snippets and line numbers. This is not switched on or off depending on who is asking.
5. The finished answer is assembled into one fixed shape for everybody: a short direct answer, then the behaviour as numbered steps, then the edge cases and conditions.
6. The chat layer sends that assembled answer through unchanged. It makes no decision about wording, level of detail, or presentation.

## Edge cases
- The wording you choose does affect which stored answer is found, and an unfamiliar phrasing can trigger a slower fresh reading of the code. That is a matching effect from the words used, not an adaptation to your expertise — the answer that comes back is written in the same plain style either way.
- Replies vary by situation rather than by person: an answer whose underlying code has changed opens with a note that it may be out of date, and an answer re-read after being flagged opens with its own note. Everyone in that same situation sees the same notice.
- The only thing that personalises a reply at all is the conversation you are in: follow-up questions are understood against your earlier questions in the same thread. That memory is per-conversation, not per-person, and it is lost when the bot restarts.
- Stored answers can be written or edited by hand, so their exact wording varies from entry to entry — but each entry is served identically to every asker.
- A few replies mention in plain words that an entry is a file a developer can correct. That wording is the same whether or not the asker is a developer, and no file is ever named.
