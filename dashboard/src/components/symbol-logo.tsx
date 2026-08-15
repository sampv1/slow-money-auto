"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A company logo, or nothing.
 *
 * WHY NOTHING RATHER THAN A PLACEHOLDER: the only caller puts this immediately
 * left of the ticker set in 30px type. A monogram tile there renders "NLG" beside
 * "NLG", which reads as a rendering bug rather than as a fallback — and a blank
 * tile buys alignment at the cost of a permanent empty box on the 29% of symbols
 * that have no logo on file. The logo is here for recognition; with no logo there
 * is nothing to recognise, so it yields its space.
 *
 * TWO ways to have no image, both landing here:
 *   - `src` is null — 29% of symbols have no logo (measured, migration 050).
 *   - the request fails — the files live on a third-party S3 bucket we do not
 *     control, and our own CSP has blocked it once already.
 *
 * Plain <img>, not next/image: the optimizer rejects hosts absent from
 * next.config's remotePatterns, and routing a 36px icon through our own image
 * pipeline is not worth the config.
 */
export function SymbolLogo({
  symbol,
  src,
  size = 36,
}: {
  symbol: string;
  src: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement | null>(null);

  // onError ALONE IS NOT ENOUGH on a server-rendered page.
  //
  // The <img> ships inside the SSR HTML, so the browser can start AND finish
  // loading it before React hydrates. A failure in that window has already been
  // dispatched by the time the handler is attached, and React does not replay
  // it — leaving a broken-image glyph in a STICKY header, i.e. on screen for the
  // whole page.
  //
  // Found the hard way: the CSP blocked this host, every logo failed pre-
  // hydration, and the component sat there with `failed` still false.
  // `complete && naturalWidth === 0` is the DOM's own record of "finished, with
  // nothing to show" — exactly the state onError missed.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (!src || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={symbol}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      // object-contain, not cover: these are logos on their own background, and
      // cropping them square cuts wordmarks in half.
      className="shrink-0 rounded object-contain bg-panel-2"
    />
  );
}
