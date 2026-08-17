"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
  /** Marks the flagship page — see FeaturedMark. */
  featured?: boolean;
}

/**
 * The "this is the important one" mark.
 *
 * A FOURTH channel on purpose. This nav had already spent all three of its
 * others — a solid inked ground means active, a ground plus an inked underline
 * means hover, and the accent is reserved for links — so the instinctive answer,
 * a coloured background, is the one thing that breaks: an always-on fill makes
 * this item's hover feedback invisible and competes with the active tab. A
 * leading mark takes nothing away from that vocabulary.
 *
 * `fill-current` is what makes it free of state handling: ink on paper when idle,
 * and it inverts to cream by itself once it sits on the active tab.
 *
 * Drawn rather than typed (◆ U+25C6) for the same reason the trend arrows are:
 * the glyph's size and weight swing between the fonts this app actually gets, and
 * a mark that renders chunky in one and hairline in another is worse than none.
 *
 * aria-hidden: it is decorative emphasis, not information. Adding "featured" to
 * the link's accessible name would make every screen-reader pass through the nav
 * read it, which is noise — what the page is worth is conveyed by the page.
 */
function FeaturedMark() {
  return (
    <svg
      width={7}
      height={7}
      viewBox="0 0 8 8"
      aria-hidden="true"
      className="mr-1.5 inline-block shrink-0 align-middle fill-current"
    >
      <path d="M4 0 L8 4 L4 8 L0 4 Z" />
    </svg>
  );
}

export function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    // Full-width row that wraps whole items onto a new line when they don't
    // fit — so longer labels (e.g. Vietnamese) are always shown in full and
    // never break mid-word. whitespace-nowrap keeps each label on one line.
    <nav className="flex flex-wrap items-center">
      {links.map((link) => {
        const isActive =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);
        return (
          // Active = a SOLID INKED TAB, not an underline or a tinted chip. Two
          // reasons: the accent is reserved for links, and a blue "selected"
          // state competed directly with the blue series in the charts below it
          // — which is exactly the collision that made the current panel and
          // period unreadable on /macro.
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            // Hover has to be unmistakable on a nav this wide: the item takes a
            // filled ground AND an inked underline, so the pointer's target is
            // obvious BEFORE the click. A tint alone on near-black text is the
            // change people miss.
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-body transition-colors duration-100 ${
              isActive
                ? "border-line-strong bg-line-strong text-canvas font-semibold"
                : "border-transparent text-fg hover:border-line-strong hover:bg-panel-2"
            }`}
          >
            {link.featured && <FeaturedMark />}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
