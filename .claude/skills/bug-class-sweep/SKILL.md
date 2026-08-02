---
name: bug-class-sweep
description: After a bug is found, treat it as an instance of a class and sweep the whole codebase for every other instance — classify each as firing, latent, or false positive, fix them, and repair corrupted data. Use when a concrete bug has just been diagnosed and you want to know where else the same mistake lives, or when the user says "fix similar issues", "check the rest of the code for this", or "is this bug anywhere else". Do not use for open-ended code review with no triggering bug, for style cleanups, or for reviewing a diff (use /code-review for that).
---

# Bug-Class Sweep

One bug is a data point. The useful question is what *class* it belongs to and where else that class lives. This skill turns a single confirmed bug into a codebase-wide audit.

The failure this exists to catch: **code that produces a plausible-looking wrong value instead of failing.** Those bugs don't announce themselves — no exception, no log line, no alert. They are found by someone eyeballing a dashboard and saying "I don't believe that number." By then the bad value is in the database, in the derived metrics, and possibly frozen into something that can't be recomputed.

## Required input

A **confirmed, diagnosed** bug — root cause understood, not just a symptom. If the root cause isn't established yet, stop and diagnose first; a sweep based on a guessed cause searches for the wrong pattern and produces confident, useless results.

## Workflow

### 1. Characterize the class

Do not skip to grepping. Write down the *ingredients* that made this bug possible — usually 2–4 independent conditions that had to coincide. The ingredients are the search patterns; the specific symbol names are not.

Ask:
- What assumption did the code make that the input violated?
- What let a wrong value through instead of raising? (missing bound, missing range check, silent fallback, `except: pass`, a default like `or 0`)
- What made it *stay* wrong? (a priority rule, a cache, an append-only table, a frozen artifact)
- Would this failure have produced an error anywhere, at any point? If no, that silence is itself the class.

State the class in one sentence before searching. Example from this repo:

> A parser that, on unexpected input, produces a plausible-looking wrong number instead of failing — enabled by (a) an unbounded/fixed-width search window, (b) no plausibility range on the result, (c) a downstream guard that made the bad value sticky.

### 2. Enumerate candidate sites

Search on the *ingredients*, across the whole repo — not just the file where the bug was found, and not just the subsystem. Cast wider than feels necessary; the cost of an extra candidate is one minute of checking, and the cost of a missed one is another silent-corruption incident.

Use several independent searches, because any single pattern misses instances:
- structural (`re.search` over a slice, `[i:i+N]`, `.range(` without `.order(`)
- behavioural (every function that converts external text/HTML/JSON into a stored number)
- by role (every writer to the same table; every consumer of the same value)

Then list every site with the class's ingredients, **including ones that look fine**. You need the sites that are already correct — see step 5.

### 3. Classify each candidate — measure, never assume

For each site, determine which it is:

| Verdict | Meaning | Action |
|---|---|---|
| **Firing** | Producing wrong values in production now | Fix + repair the data |
| **Latent** | Structurally vulnerable, not currently triggered | Fix; state what would trigger it and when |
| **False positive** | Ingredient absent on inspection | Note why, no change |

**Run the code or query the data. Do not reason your way to a verdict.** Fetch the live page, query the real table, count the real rows. A latent-vs-firing call made by reading code is a guess.

For "latent", answer *when it stops being latent*. "Not currently reached" is incomplete; "max is 574 rows against a 1,000 cap, so ~1.7 years of appends, or immediately if anyone runs a deeper backfill" is a finding the user can act on.

**Watch your own diagnostics for the same bug.** Verification code is written fast and is exactly as vulnerable as the code under audit. If a diagnostic returns a number that contradicts another query, suspect the diagnostic first. Cross-check any surprising measurement a second way before reporting it.

### 4. Trace the blast radius

For each firing site:
- Which downstream consumers read the value? Derived metrics, composites, scores, caches, exports.
- Does anything make the corruption sticky — a source-priority rule, an append-only store, a frozen/validated artifact, an as-of forward-fill that spreads one bad point across later dates?
- How far back does the corruption go? Scan the full history of the affected series for other instances, so the repair is scoped correctly.

Sticky corruption is the part users most often miss: a bug that would self-heal is an incident, a bug the system actively protects is a permanent wrong number.

### 5. Fix — match the codebase's own established guard

Before writing a new guard, look at the sites in step 2 that were **already correct**. A mature codebase usually already contains the right pattern somewhere; reuse it rather than inventing a parallel convention. Matching an existing guard also makes the fix obviously reviewable.

Principles:
- **Refuse, don't guess.** When input is malformed, return nothing and let the fallback source fill in. Never infer a plausible replacement value — that converts a detectable gap into an undetectable error.
- **Bound the scope of any search** to the structural unit that actually holds the value (the cell, the field, the record) rather than a character count.
- **Add a plausibility range** on anything parsed from an external source, wide enough never to reject a real move.
- **Comment with the incident.** State what went wrong and what the guard prevents, so nobody "simplifies" it away later.

### 6. Verify each fix three ways

1. **Live input** still parses correctly (the fix didn't break the happy path).
2. **The known-bad input** is now rejected (the fix actually works) — synthesize it if it's no longer live.
3. **Integration**: run the pipeline/entry point end-to-end and confirm counts match pre-change.

A fix verified only against the bad case may have broken the good case, and vice versa. Check both.

### 7. Repair the data — with confirmation

Code fixes stop new corruption; they don't remove what's already stored. Identify the affected rows and propose the exact repair.

**Never mutate or delete production data without explicit confirmation.** Present the precise statement and what will refill the gap. Also flag any derived artifact that needs recomputation once the source value is corrected.

### 8. Report

Report a table of every site with its verdict, then:
- **What was firing** and what it corrupted
- **What is latent** and what would trigger it
- **What was already correct** — this is real signal about the codebase's health, not filler
- **Data repairs still needed**, awaiting confirmation

Be exact about firing vs latent. Overstating a latent bug as active destroys trust in the whole report; burying an active one in a list of theoretical risks is worse.

## Anti-patterns

- Grepping for the specific broken symbol instead of the class → finds one site, misses the rest.
- Declaring a site latent or firing by reading code → produces confident wrong verdicts.
- Fixing only the subsystem where the bug appeared → the class rarely respects module boundaries.
- Replacing a bad parse with a guessed value → trades a visible gap for an invisible error.
- Reporting only what you fixed → the already-correct sites are how the user learns the codebase's real state.

## Project-specific catalogue

`references/known-classes.md` records bug classes already found in this repo, with the sites checked and their verdicts. **Read it during step 1** — a new bug is often a fresh instance of a known class. **Update it during step 8** with any new class and its verdicts, so each sweep starts where the last one finished.
