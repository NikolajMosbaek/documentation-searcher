---
title: Hand-written answers are never flagged as out of date
keywords: hand-written answer, written by a developer, seeded entry, out of date, possibly out of date, stale answer, staleness check, re-check on read, verify on read, refresh, knowledge base entry, manual entry, curated answer, warning notice
derived-from: src/core/index.ts, src/core/knowledgeBase.ts, src/core/core.test.ts, src/core/knowledgeBase.test.ts, src/core/engine.ts, src/core/answer.ts, knowledge-base/trial-expiry.md, src/core/fixtures/corpus/why-an-answer-is-labelled-possibly-out-of-date.md, PRD.md
fingerprint: e5b4c99784e9ba4f
---

## Questions
- do answers written by hand ever get marked as out of date?

## Short answer
No. An answer a person wrote by hand is always served exactly as written and never carries the possibly-out-of-date notice, because it holds no record of which parts of the codebase it came from, so there is nothing to compare against. The only things that change such an answer are a developer editing it, or someone flagging it as wrong in the thread.

## What happens
1. Someone asks a question and the assistant finds a stored answer that matches it.
2. Before handing the answer over, the assistant looks for two things attached to it: a record of which parts of the codebase it was built from, and a snapshot of what those parts looked like when it was written.
3. An answer written by a developer by hand carries neither, so the change check is skipped entirely.
4. The hand-written answer is returned immediately, with no warning notice, and without paying to re-read the codebase.
5. Answers the assistant wrote itself do carry that record, so for those the current code is compared against the snapshot, and a mismatch triggers a fresh read and either a rewritten answer or the possibly-out-of-date notice.

## Edge cases
- The rule keys off whether the record of origin is present, not off who typed the entry. If a developer hand-writes an entry and deliberately fills in both the list of code locations and a matching snapshot value, that entry is change-checked exactly like a machine-written one, and can be flagged or refreshed.
- Either half of that record being missing is enough to switch the check off: no listed code locations, or no snapshot value, means the entry is never called out of date.
- Flagging the answer as wrong in the thread bypasses this completely. The assistant re-reads the codebase and rewrites the entry in place, so a hand-written entry can be overwritten that way even though it would never have been flagged on its own.
- Once an entry has been rewritten by the assistant after a flag, it gains the record of origin and is change-checked from then on, so it is no longer treated as hand-written.
- With no codebase configured for the installation, no stored answer of any kind is change-checked, so the notice cannot appear at all.
- The assistant will never merge a newly derived answer into a hand-written one, because merging requires matching snapshots. A machine-written entry covering the same ground can end up sitting alongside the hand-written one.
- There is no scheduled rebuild or background job anywhere in this: checks only happen because someone asked a question.
