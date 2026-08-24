# Documentation Searcher

## Problem Statement

Questions about how a codebase behaves come from everyone — product owners, testers, and other developers. Today all of those questions route through a developer.

That developer usually doesn't know the answer offhand either. So they ask an AI coding assistant, read the result, and relay it back. They are a middleman in front of a tool the asker could have used directly, if only it were reachable and trustworthy from where they work.

This costs three things at once:

- **The developer is interrupted** for work that isn't really theirs to do, and pays the context-switch every time.
- **The asker is blocked** while they wait for someone else's attention before they can act.
- **The answer is never captured.** It is re-derived from scratch on every asking, so nothing accumulates — the tenth person to ask the same question costs exactly as much as the first.

## Solution

A Microsoft Teams bot, bound to a single codebase, that anyone in the organisation can ask about that codebase's behaviour in plain language — and get a structured, understandable answer back without a developer in the loop.

Behind the bot is a **documentation layer**: an AI-first knowledge base that lives alongside the code. Every question hits that layer first. When it holds a good answer, the reply is immediate. When it doesn't — or when the code behind a stored answer has changed since the answer was written — the bot searches the codebase itself, writes what it learns back into the knowledge base, and then answers.

The knowledge base is therefore maintained from both directions: the bot fills and refreshes it as questions arrive, and developers seed, edit, and correct it directly. Over time the codebase becomes something you can hold a conversation with, and the cost of answering the same question twice falls to nearly nothing.

## User Stories

1. As a product owner, I want to ask in Teams how a feature behaves and get an answer without involving a developer, so that I am not blocked waiting for someone else's attention.
2. As a tester, I want the answer to spell out the conditions and edge cases of a behaviour, so that I can write test cases directly from it.
3. As a developer, I want questions about my codebase answered without me, so that I am not interrupted for work that isn't mine.
4. As an asker, I want answers written in product language with no code references, so that I can understand them regardless of my technical background.
5. As an asker, I want to ask follow-up questions in the same Teams thread and have my earlier questions remembered, so that it feels like a conversation rather than a series of unrelated lookups.
6. As an asker, I want a question that has been answered before to come back instantly, so that the same work is never redone.
7. As an asker, I want the bot to notice when the code behind a stored answer has changed and re-derive the answer, so that I am never handed a silently outdated answer.
8. As a developer, I want the knowledge base to live with the code as editable files, so that I can correct an entry and have that correction reviewed alongside the change that caused it.
9. As a developer, I want to write knowledge-base entries ahead of any question being asked, so that the first person to ask about a new area already gets a good answer.
10. As anyone who receives a wrong answer, I want to flag it in the Teams thread, so that the entry gets corrected without me leaving the conversation.
11. As a developer setting this up on an existing codebase, I want the bot to propose which areas are worth documenting first and let me review what it writes, so that day one is not a cold start.

## Implementation Decisions

**Interface**

- Microsoft Teams is the interface from day one. Non-developers ask the bot directly; a developer is never required to relay a question.
- Questions and answers are threaded, and a thread carries context so follow-up questions work.

**Scope of a deployment**

- One install serves exactly one codebase. There is no repository selection, routing, or disambiguation — asking is unambiguous by construction. Serving several codebases means several installs.

**The documentation layer**

- The knowledge base is **AI-first**: structured and optimised for retrieval rather than for reading. Humans can and do correct it, but nobody is expected to read it top to bottom.
- It is stored alongside the code and version-controlled, so entries are editable by developers and their edits move through normal code review.

**How answers are produced**

- The documentation layer is always consulted first.
- **Verify on read.** Before answering from a stored entry, the bot checks whether the code that entry covers has changed since the entry was written. If it has, the entry is re-derived from the codebase and refreshed before answering.
- **Lazy population on miss.** When no entry covers the question, the bot searches the codebase, writes a new entry, and answers from it.
- No CI hooks, commit hooks, or scheduled rebuilds are required for the knowledge base to stay correct.

**How answers are presented**

- Answers are structured: a short direct answer, then the behaviour broken down step by step, then the edge cases and conditions.
- Answers are written in product language. They contain no file paths, function or class names, or code snippets.
- The answer format is the same for every asker; it does not detect or adapt to how technical the asker is.

**How the documentation layer is maintained**

- **By the bot** — filling gaps on a miss, and refreshing entries found to be stale on read.
- **By developers, as files** — editing entries in the repository, reviewed like any other change.
- **By developers, ahead of time** — seeding entries for an area before anyone asks about it.
- **By anyone, from Teams** — flagging a wrong answer in the thread so the entry gets corrected from there.

**Setup on an existing codebase**

- **Guided seeding.** At setup the bot proposes which areas of the codebase are worth documenting first. Developers choose from that proposal and review what gets written, producing a reviewed baseline rather than an unattended bulk index.

## Out of Scope

- **A CLI front end.** Teams is the only interface. A CLI was considered and deliberately dropped — it would only serve people who already have a checkout and a terminal, which is precisely the developers this product is trying to take out of the loop.
- **Any source beyond the codebase and its documentation layer.** No answers are drawn from Jira, Confluence, pull request discussions, wikis, or runbooks. The code and the knowledge base derived from it are the only sources of truth.

## Further Notes

**Deliberately open questions.** These were raised and left undecided rather than resolved in either direction:

- Whether the bot may go beyond answering and propose changes to the code itself. This would be a materially larger product.
- Whether access control is needed — whether some people, codebases, or areas should be restricted. At present, anyone who can reach the bot can ask anything about that codebase.

**On verification.** Answer verifiability was considered and deliberately deprioritised. When the costs of the current situation were ranked, distrust of answers was explicitly *not* among them — the pain is the bottleneck, not correctness disputes. This is why answers carry no code references for the asker to check against, even though the knowledge base is derived from code. If trust turns out to be a problem in practice, this decision should be revisited.
