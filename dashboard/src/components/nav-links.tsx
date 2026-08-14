"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
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
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
