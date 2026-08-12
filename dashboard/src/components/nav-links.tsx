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
    <nav className="flex flex-wrap items-center gap-1 pb-2">
      {links.map((link) => {
        const isActive =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap px-2.5 py-1.5 text-body rounded-md transition-colors ${
              isActive
                ? "text-accent font-semibold bg-accent-soft"
                : "text-fg-muted hover:text-fg hover:bg-panel-2"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
