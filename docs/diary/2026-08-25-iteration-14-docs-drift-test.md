# Diary: Iteration 14 — checking the README against the code

The previous iteration found three false claims in the README that had survived twelve iterations of edits, and ended by noting that the check which found them was a one-off script protecting one moment. This turned it into a test. It found a fourth thing before it was finished.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Thirteenth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes, cheaply where possible.

### What I did

Took the future-work note from the previous iteration rather than picking something new.

### Why

The observation that motivated it is one this project should be embarrassed to ignore. This product exists because documentation goes quietly wrong: an entry written correctly, invalidated by a change nobody connected to it, and served for months because nobody re-reads documentation. The bot re-checks every entry against the code it came from on every single read. Its own README had three claims that were true when written and false by the time anyone read them, and nothing anywhere checked.

Fixing them by hand and moving on would have left the mechanism that produced them entirely intact.

### What worked

The scope was already established. The previous iteration ran the comparison manually, so the question was only how much of it to automate.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing new; this was following through on something already written down.

### What was tricky

Deciding how far to go. Most of a README is prose, and no test reads prose. The temptation is to conclude that the checkable part is not worth checking. But all three stale claims were mechanical — a module's described purpose, a function's return type, and whether a limitation still existed — and two of those three are exactly the kind a test can catch.

### What warrants review

Prose is still unchecked, which is most of the document.

### Future work

None from this step.

## Step 2: Building it, and the fourth thing

**Author:** main

### What I did

Added `/src/docs.test.ts` with five checks:

- every source file under `src` appears in the README's Layout block;
- every path the Layout block names exists on disk;
- every setting the code reads from the environment is in the configuration table;
- every setting in the configuration table is read somewhere;
- every `npm run …` the README tells you to run is a real script.

Then had to change the test command. It had been `node --import tsx --test src/core/*.test.ts`, which would not have picked up a test outside `src/core`. Node's own glob support for `--test` is not available on the Node 20.11 floor this package declares, so the script names both paths explicitly rather than relying on one.

### Why

These five are the mechanical claims a README makes. Anything a reader could act on and be wrong about — a file that does not exist, a setting that does nothing, a command that fails — is now checked by the same suite that checks the product.

### What worked

Running the comparison before writing the test, which found a fourth stale thing:

```
=== env vars read in src ===         === documented in the README table ===
NODE_ENV                             (absent)
```

`NODE_ENV` is read to decide whether the bot accepts unauthenticated requests. It was described in prose, in the section about the local Playground, and was missing from the configuration table where anybody deploying this would look for it. Of everything in that table it is the one with a security consequence: anything other than `production` accepts unauthenticated requests on the endpoint. Now documented as a row, with what happens if it is unset.

### What didn't work

Nothing failed. The one design question was what to do about `NODE_ENV` — an exemption list in the test would have been the quick way past it, and would have encoded the omission as intentional. It was not intentional; it was the fourth instance of exactly what this iteration is about.

### What I learned

A drift check is worth running once by hand before automating, because whatever it finds on that first run is the backlog the automation would otherwise have started by asserting as correct. Had I written the test first and made it pass, `NODE_ENV` would have gone into an allow-list and stayed undocumented.

### What was tricky

Bounding what counts as a claim. "Every setting is documented" is unambiguous. "Every behaviour described is real" is not checkable at all. The line drawn is: anything that names a file, a setting, or a command — things with an existence a program can confirm.

### What warrants review

- **The Layout block is still hand-maintained**, only now it fails loudly instead of drifting quietly. That is the improvement, not a generated section.
- **Only `src` is scanned.** A setting read from a workflow file or a script elsewhere would not be seen.
- **The test reads the README with regular expressions**, so restructuring the document's headings can break the test without anything being wrong.

### Future work

Nothing outstanding.

## Step 3: Verifying it

**Author:** main

### What I did

Broke each of the five conditions deliberately, one at a time, and confirmed the corresponding test failed — then restored and confirmed the suite passed again.

### Why

A test that cannot fail is worse than no test: it reports that something is checked when nothing is. Every one of these five passed the moment it was written, which is exactly what a test that checks nothing also does. The only way to tell the difference is to make each one fail on purpose.

### What worked

All five caught their own case:

```
--- 1. a source file nobody documented ---
not ok 70 - every source file is described in the README
--- 2. a README path that does not exist ---
not ok 71 - every file the README describes exists
--- 3. a setting read but undocumented ---
not ok 72 - every setting the code reads is documented
--- 4. a setting documented but never read ---
not ok 73 - every documented setting is actually read
--- 5. a command the README invents ---
not ok 74 - every command the README tells you to run exists
```

Each break was undone immediately and independently, and the suite returned to seventy-four passing with a clean working tree.

### What didn't work

Nothing.

### What I learned

This is the third distinct instance tonight of the same underlying problem, and the pattern is now clear enough to name. A verification that has never been observed failing is not a verification: iteration 1 had a wait loop that did not wait, iterations 6 and 9 had string replacements that silently matched nothing, and iteration 10 had a test asserting a field of an object while the rendered output contradicted itself. In every case the run looked clean.

The cost of checking is small — five deliberate breaks took two minutes — and the alternative is a suite that grows a section nobody has ever seen fail.

### What was tricky

Restoring cleanly between breaks. Each one edited a file the next check also reads, so they were reverted individually from a backup rather than in a batch at the end, and the working tree was inspected afterwards. Chaining cleanup behind a command whose failure destroys the evidence is a trap this project hit in its first iteration.

### What warrants review

The breaks tested the checks, not the messages. Each assertion carries an explanation for whoever trips it, and those were written once and read never.

### Future work

None.
