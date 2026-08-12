"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Quarter picker for the FA panel. Updates the `fq` search param (preserving
// any other params, e.g. `ind`) so the server re-renders the chosen snapshot.
export function FaQuarterSelect({
  quarters,
  selected,
  label,
}: {
  quarters: string[];
  selected: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("fq", e.target.value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <label className="text-data text-fg-muted flex items-center gap-1">
      {label}
      <select
        value={selected}
        onChange={onChange}
        className="border border-line rounded px-1.5 py-0.5 text-data"
      >
        {quarters.map((q) => (
          <option key={q} value={q}>{q}</option>
        ))}
      </select>
    </label>
  );
}
