---
name: bilingual-ui-check
description: Verify a dashboard UI change in BOTH English and Vietnamese before calling it done. Use whenever you add or change anything rendered in dashboard/src — a table, column, label, badge, filter, modal, card or page — and before reporting any UI work as complete. Catches the failures that only appear in one locale: Vietnamese labels are 20-40% longer and blow out column widths, and English copy pasted into the vi block ships untranslated. Do not use for Python pipeline work or for changes with no rendered output.
---

# Check both locales before calling a UI change done

This site is bilingual and **`DEFAULT_LOCALE` is `vi`** (`dashboard/src/lib/i18n.ts`).
Rendering a page without a cookie gives you Vietnamese. It is very easy to verify
in one locale, see it look right, and ship a layout that is broken in the other.

## Why this exists — both failures are real, and both shipped

**Vietnamese overflowed the Portfolio table by 356px.** Every header was
`whitespace-nowrap`, so the *labels* set the column widths. `ƯỚC TÍNH % THẮNG`
held **148px** open for cells reading `80%`; `Win Rate Est` would have needed far
less. The table ran 1,553px and overflowed even a 1920 viewport. It was found by
the user, not by me, because I had only looked at whether the numbers were right.

**English prose leaked onto the Vietnamese page.** `scripts/fa/real_estate.py`
stored the scorer's reasoning as English text in `breakdown.note`, and the RE
scanner rendered it verbatim — so a Vietnamese reader got "cash burn scores 0
regardless of debt". The fix was storing a stable KEY (`cfo_not_positive`) and
translating at render. Anything a Python script writes that reaches the DOM has
this problem.

## The check

Run it against a production build (`next start`, **not** `next dev` — dev's
timing and caching differ enough to hide problems).

### 1. Both locales render

The locale is a cookie named `locale`:

```bash
curl -s http://localhost:PORT/your-page                     # vi (default)
curl -s -H "Cookie: locale=en" http://localhost:PORT/your-page
```

Read the actual text out of both. Confirm the vi strings are *translated*, not
English copy-pasted into the `vi` block. TypeScript will not help you here:
`TranslationKey = keyof typeof translations.en`, so a **missing** key is a
compile error but an **untranslated** one is perfectly valid.

### 2. Layout survives the longer language

Vietnamese runs 20-40% longer than English for the same label, and diacritics add
height. For anything with columns, measure — do not eyeball:

```js
// via CDP Runtime.evaluate, at the widths that matter (1280 / 1440 / 1920)
(() => {
  const box = document.querySelector('table').parentElement;
  const t = document.querySelector('table');
  const clipped = [...document.querySelectorAll('table td, table th')]
    .filter(c => c.scrollWidth > c.clientWidth + 1)
    .map(c => c.innerText.trim().slice(0, 20));
  return { overflow: t.scrollWidth - box.clientWidth, clipped };
})()
```

`overflow > 0` means a horizontal scrollbar. `clipped` non-empty means content is
being squeezed under its neighbour — "it fits" must mean *readable*, not merely
*no scrollbar*.

If it overflows, the fix is usually **let the headers wrap** (`leading-tight`,
drop `whitespace-nowrap` from the `th` only) so the DATA sizes the column. That
alone took the Portfolio table from +356px to 0 at 1440.

### 3. Things that break in exactly one locale

- **Badges and pills** — `Đang mở` wraps to two lines where `Open` does not. Keep
  `whitespace-nowrap` on the badge itself.
- **Two-word English, four-word Vietnamese** — tab strips, filter labels, buttons.
- **Diacritic height** — stacked marks on `Ề Ệ ữ ậ` clip if a row height is
  forced below ~24px. See the `row-h` note in `globals.css`.
- **Numbers are vi-VN in BOTH locales** by deliberate project decision
  (`formatNumber`), so `1.431` on the English page is correct, not a bug.

## Done means

Both locales rendered from a production build, layout measured at the widths that
matter in the **longer** language, no clipped cells, and every new string actually
translated. Say which locales and widths you checked; if one still overflows
somewhere, say where rather than implying it fits everywhere.
