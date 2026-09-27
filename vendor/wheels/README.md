# vendor/wheels — vnstock and vnai, supplied out of band

**This directory is intentionally empty in git.** The two wheels it is meant to
hold are proprietary and this repository is public.

## What happened (2026-09-25)

PyPI **quarantined** both `vnstock` and `vnai`. The project pages still answer
`200`, but the simple index carries `pypi:project-status: quarantined` and lists
**zero files**, so for everyone, everywhere:

```
ERROR: Could not find a version that satisfies the requirement vnstock==4.0.4
       (from versions: none)
ERROR: No matching distribution found for vnstock==4.0.4
```

`from versions: none` is the tell — not a version that was yanked, an index with
nothing in it at all.

All seven daily workflows install from `scripts/requirements.txt`, so all seven
died at `Install dependencies` in 10-20 seconds and the pipeline collected
nothing for the 2026-09-25 session. **A version pin does not protect against a
package being withdrawn**, and neither does the GitHub pip cache: pip resolves
against the index *before* it consults the cache, so resolution fails first.

`vnai` is the harder half. It is a hard dependency of `vnstock`, it is
quarantined too, and it has **no public source repository** —
`github.com/thinh-vu/vnai` is `404`. `github.com/thinh-vu/vnstock` still exists;
its sibling packages (`vnstock_data`, `vnstock_ta`, `vnstock_ezchart`) are still
active on PyPI.

## Why the wheels are not committed here

| Package | License |
|---|---|
| `vnstock` | `Custom: Personal, research, non-commercial; contact support@vnstocks.com for other use` |
| `vnai` | `proprietary` |

This repo is public. Committing either wheel would redistribute restricted
software to anyone who clones it — and the projects being under an
administrative hold makes that worse, not better. The licence is also why the
answer is not "mirror it somewhere convenient": a mirror is still distribution.

## How to supply them

`scripts/requirements.txt` already carries `--find-links vendor/wheels` (and
`../vendor/wheels`, so the path resolves whether pip runs from the repo root as
the workflows do, or from `scripts/` as a developer does). pip warns and
continues when the directory is empty, so nothing breaks by leaving it so; the
install simply falls back to PyPI and fails while the quarantine stands.

Drop `vnstock-4.0.4-py3-none-any.whl` and `vnai-2.4.9-py3-none-any.whl` in here
and the install works offline. Both are pure `py3-none-any`, so a wheel repacked
from a working install is faithful — the installed layout *is* the wheel layout.

For CI, in order of preference:

1. **Get a licensed channel from the vendor.** `support@vnstocks.com`, or the
   Insiders programme the package advertises. This is the only route that is
   both durable and unambiguously permitted, and it is the one to pursue.
2. **Host the wheels in a private store** the workflow fetches with a secret — a
   private repo release, S3, or GitHub Packages — and add a step before
   `Install dependencies`. Private, so not redistribution, but check the licence
   terms cover your use.
3. **A self-hosted runner** with both packages pre-installed.

Until one of those is in place the daily workflows cannot install, and the
pipeline has to be run by hand from a machine that already has a working
install. `.claude/skills/data-audit/SKILL.md` has the recovery order.

A longer-term option worth evaluating separately: the still-active
`vnstock_data` / `vnstock_ta` packages may cover what this pipeline uses, which
would remove the dependency on a quarantined project altogether. That is a
migration, not a fix, and it needs its own measurement pass — every provider
call in `scripts/ta/` reads through `vnstock`.
