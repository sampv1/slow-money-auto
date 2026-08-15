---
name: prod-check
description: Verify what the LIVE site at www.loctinhieu.com is actually serving — after a deploy, after a migration, or when the user says something looks wrong in production. Covers reaching the right host, confirming a deploy landed, driving the real page in headless Chrome to measure rendered output, and the stale-cache trap that makes production disagree with the database. Use when asked to check production, confirm a fix went live, or diagnose "it looks wrong on the site". Not for local-only work.
---

# Checking production

Production is two halves that can disagree: the **site** (Vercel) and the
**database** (Supabase). Most "production looks wrong" reports are one of them
being stale relative to the other, not a code bug.

## Reach the right host

Canonical is **`www.loctinhieu.com`**. The apex 308-redirects, so a `curl` or
webhook POST without `www` (or `-L`) hits the redirect, not the app.

```bash
curl -sL -o /dev/null -w '%{http_code} %{url_effective}\n' https://www.loctinhieu.com/portfolio
```

You see the site **anonymously**. Admin-only UI — the Portfolio Action column,
Sell buttons, journal Edit controls — is not in the HTML at all. Do not report
"the button is missing"; you cannot see it from here. Write endpoints correctly
answer `403` (`/api/recommendations/journal`) and `401` (`/api/revalidate`
without the secret) — that is the gate working, not a failure.

## Confirm a deploy actually landed

Vercel takes roughly 40-60s. Poll for a string that only the new build emits —
a new class name, a new `aria-label` — rather than sleeping a fixed amount:

```bash
for i in $(seq 1 40); do
  curl -s https://www.loctinhieu.com/PAGE | grep -q 'MARKER' && { echo "live after ~$((i*10))s"; break; }
  sleep 10
done
```

`gh run list` / `gh run view --log` work directly now (the default repo is set to
`sampv1/slow-money-auto`). Actions logs are purged after a while — do not count
on reading a run from a week ago.

## THE TRAP: the Data Cache outlives both deploys and migrations

Public reads go through `unstable_cache` (`dashboard/src/lib/cached-data.ts`),
tagged `ta-data` / `fa-data` / `macro-data` / `rec-data` / `feedback-data`, 1h TTL.

**A browser reload does not bypass it. Neither does a redeploy. Neither does
rebuilding locally.** After migration 049 rewrote existing rows, production kept
serving the pre-migration text with no error anywhere — and locally the page
still claimed the migration was unapplied. That produced two false diagnoses in
one session before I recognised it.

So: **any migration that rewrites existing rows, or any DB edit made outside the
app, must be followed by a revalidate.** The secret goes in the HEADER, never the
query string (a query string leaks it into Vercel/proxy logs):

```bash
set -a; . scripts/.env; set +a
curl -fsS -X POST -H "x-revalidate-secret: ${REVALIDATE_SECRET}" \
  "https://www.loctinhieu.com/api/revalidate?tags=rec-data"
```

Locally, `rm -rf .next/cache` also destroys the build id — you must rebuild
after. Revalidating is cleaner.

## Measure what RENDERS, not what is served

HTML strings and class names lie. Two examples from this codebase:

- A cell carried `text-down` in its class list and still rendered **black**,
  because a base class contributed `text-fg` and Tailwind orders colour
  utilities alphabetically. Only `getComputedStyle` showed it.
- "The table fits" was false even with no scrollbar, because cells were squeezed
  under their neighbours. Only `scrollWidth > clientWidth` per cell showed it.

Drive the real page. Node 22 has a native `WebSocket`, so this needs **no
dependencies** — do not add Playwright/Puppeteer to the repo for this:

```bash
google-chrome --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222 about:blank &
```

```js
const t = (await (await fetch("http://localhost:9222/json")).json()).find(x => x.type === "page");
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) pending.get(m.id)(m); };
const send = (method, params = {}) => new Promise(res => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async expression => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.enable");
await send("Page.navigate", { url: "https://www.loctinhieu.com/portfolio" });
```

Then wait for the STYLESHEET, not a guess — screenshots taken too early come back
unstyled:

```js
for (let i = 0; i < 40; i++) {
  if (await ev(`getComputedStyle(document.documentElement).getPropertyValue('--color-desk').trim()`)) break;
  await new Promise(r => setTimeout(r, 250));
}
```

### Escaping, which has bitten twice

The probe is a JS string inside a JS template literal inside a shell heredoc.
`\n` collapses into a real newline and breaks the evaluated string — write `\\n`,
or avoid it by **returning an array/object** and formatting in Node. Prefer the
latter. Also surface exceptions; a silent `undefined` looks like "no data":

```js
const r = await send("Runtime.evaluate", { expression, returnByValue: true });
if (r.result?.exceptionDetails) console.log("EXCEPTION", r.result.exceptionDetails);
```

## The other half: the database

`scripts/.venv/bin/python` with `ta.common.resolve_supabase_key()` reads and
writes production directly (service role, bypasses RLS). Use it to answer "is the
site wrong, or is the data wrong?" — query the row and compare against what the
page renders.

- Never print secret values.
- **Confirm with the user before any production mutation**, and snapshot the rows
  you are about to change to `tmp/` first so it is reversible.
- A denied PostgREST write returns 204 with zero rows, not an error — check the
  returned row count rather than trusting the absence of an exception.

## Reporting

Say what you measured, at what widths/locales, and what you could not check.
"Verified live" means a computed value from the real page, not a class name in
the HTML. If something is only type-checked — anything behind the admin gate —
say so instead of implying coverage.

Related: `bilingual-ui-check` for the locale half of any UI verification.
