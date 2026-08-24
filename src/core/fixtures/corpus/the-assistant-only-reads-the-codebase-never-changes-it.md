---
title: The assistant only reads the codebase, never changes it
question: What is the assistant allowed to do to the codebase while it works out an answer?
keywords: read-only access, what can the assistant change, does it edit files, does it delete files, permissions, safety, can it run commands, does it modify the code, write access, sandbox
derived-from: src/core/claudeEngine.ts, src/core/claudeResolver.ts, src/core/knowledgeBase.ts, src/core/sourceIndex.ts, src/core/index.ts, src/core/correction.ts, src/index.ts, README.md
fingerprint: e3ffba5c29556840
---

## Short answer
While working out an answer, the assistant can only look at the codebase: open files, search their text, and list files by name. It cannot create, change, delete, or move anything there, and it cannot run commands.

## What happens
1. When a question cannot be answered from the stored notes, a reading session is opened against the one codebase this installation is pointed at.
2. That session is given exactly three abilities: open and read a file, search for text across files, and list files matching a name pattern.
3. Those three abilities are the only ones that exist in the session, they are pre-approved so the session never stalls waiting for a person, and anything outside that list is refused outright.
4. The assistant reads and searches until it can describe the behaviour, then hands back a plain-language answer together with the list of files it read.
5. The product itself, not the assistant, then saves that answer as a note in its own separate notes collection, which lives outside the codebase.

## Edge cases
- There is no ability to write, edit, rename, move, or delete anything in the codebase, and no ability to run commands, scripts, or programs.
- Because nobody is watching the session, an attempt to use anything beyond reading is denied automatically instead of prompting for permission.
- Any instructions or settings belonging to the codebase being examined are deliberately not loaded, so the code being read cannot change the rules the assistant works under.
- Nothing about the session is kept afterwards; each question starts a fresh session.
- Reading is bounded by a limit on how many steps it may take and by a spending ceiling; hitting a limit ends the attempt with no answer rather than widening what the assistant may do.
- The product does write files, but only its own notes: a brand-new note never overwrites an existing note, while refreshing an outdated note or acting on a reported mistake rewrites that same note in place so the change is easy to review.
- The separate step that rephrases a follow-up question is given no abilities at all, so it never touches any files.
- The file names the assistant reports back are treated as untrusted; they are used only to check later whether the code has changed, and anything pointing outside the codebase is treated as missing rather than opened.
