# vendor/wheels — an offline fallback, not the primary route

**Primary route: the vendor's own package index.** `scripts/requirements.txt`
carries `--extra-index-url https://vnstocks.com/api/simple`, which is how
`vnstock` and `vnai` are installed. This directory is a second line of defence
for when that host is unreachable, and it is **empty in git on purpose**.

## Background (2026-09-25 → 2026-09-27)

PyPI **quarantined** both `vnstock` and `vnai`: the simple index carried
`pypi:project-status: quarantined` and listed **zero files**, so every install
failed with

```
ERROR: Could not find a version that satisfies the requirement vnstock==4.0.4
       (from versions: none)
```

`from versions: none` is the tell — an index with nothing in it, not a version
that was yanked. All seven daily workflows install from `requirements.txt`, so
all seven died at `Install dependencies` in 10-20 seconds and the 2026-09-25
session was never collected.

Vnstock's answer (technical notice, 2026-09-27) was to publish from their own
distribution site so the project no longer depends on PyPI. They expect the PyPI
review to take about a week; our configuration does not wait for it and does not
break if it succeeds, because pip merges both indexes and the exact pins decide
what installs.

## Why a local fallback is still worth having

The fix replaced one external dependency with another. If `vnstocks.com` is
unreachable, a populated `vendor/wheels` installs offline — pip finds the files
locally and never reaches the network for them.

Keep the versions here **matching the pins** in `requirements.txt`; wheels for
some other version are never selected and only look like cover that is not there.
To refresh after a pin change:

```bash
pip download --no-deps -d vendor/wheels \
  --extra-index-url https://vnstocks.com/api/simple \
  "vnstock==4.0.9" "vnai==2.6.2"
```

## Why the files are gitignored

| Package | License |
|---|---|
| `vnstock` | `Custom: Personal, research, non-commercial; contact support@vnstocks.com for other use` |
| `vnai` | `proprietary` |

This repository is **public**. Committing either wheel would redistribute
restricted software to everyone who clones it. Installing from the vendor's own
index does not — that is the vendor distributing their own work, which is the
whole reason it is the primary route.

`.gitignore` carries `vendor/wheels/*.whl`. Do not remove that line. pip warns
and continues when this directory is empty, so a fresh clone is correct as-is.
