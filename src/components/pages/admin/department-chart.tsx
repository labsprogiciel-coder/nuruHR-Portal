"use client";

import { useState } from "react";
import { plural } from "@/lib/leave";
import { formatMoney } from "@/lib/money";
import type { DepartmentSlice } from "@/lib/team";
import { cn } from "@/lib/utils";

const SIZE = 168;
const R = 70;
const INNER = 44;
/** Surface gap between neighbouring slices, in SVG units along the outer edge */
const GAP = 2;

const colorOf = (d: DepartmentSlice) => (d.slot ? `var(--series-${d.slot})` : "var(--text-placeholder)");
const pct = (share: number) => `${Math.round(share * 100)}%`;

/** A ring segment from angle `a0` to `a1` (radians, clockwise from 12 o'clock). */
function arc(a0: number, a1: number) {
  const point = (r: number, a: number) => `${(SIZE / 2 + r * Math.sin(a)).toFixed(2)} ${(SIZE / 2 - r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${point(R, a0)} A ${R} ${R} 0 ${large} 1 ${point(R, a1)} L ${point(INNER, a1)} A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, a0)} Z`;
}

/**
 * The team by department: a pie with the headcount in the middle and, beside it, a list that
 * names every slice with its count, share and monthly gross pay, so nothing is read from
 * colour alone. Hovering or focusing a slice or a row highlights the pair.
 */
export function DepartmentChart({ slices, total }: { slices: DepartmentSlice[]; total: number }) {
  const [active, setActive] = useState<string | null>(null);
  const current = slices.find((d) => d.name === active);

  // Angles, leaving a thin gap of surface between slices (none when there is only one)
  const gap = slices.length > 1 ? GAP / R : 0;
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((n, d) => n + d.share, 0) * Math.PI * 2);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-4">
      <div className="relative mx-auto shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={`Employees by department: ${slices.map((d) => `${d.name} ${d.count}`).join(", ")}`}>
          {slices.map((d, i) => {
            const a0 = starts[i] + gap / 2;
            const a1 = starts[i] + d.share * Math.PI * 2 - gap / 2;
            // A whole circle can't be drawn as one arc: split it in two
            const path = d.share >= 0.999 ? `${arc(0, Math.PI)} ${arc(Math.PI, Math.PI * 2 - 0.0001)}` : arc(a0, Math.max(a1, a0 + 0.001));
            return (
              <path
                key={d.name}
                d={path}
                fill={colorOf(d)}
                onMouseEnter={() => setActive(d.name)}
                onMouseLeave={() => setActive(null)}
                className={cn("transition-opacity duration-150", active && active !== d.name && "opacity-35")}
              >
                <title>{`${d.name}: ${plural(d.count, "employee", "employees")} · ${pct(d.share)}`}</title>
              </path>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center" aria-hidden>
          <span className="text-[26px] leading-none font-medium tracking-[-0.5px] text-fg tabular-nums">{current ? current.count : total}</span>
          <span className="t-12 max-w-[76px] truncate text-fg-2">{current ? pct(current.share) : total === 1 ? "employee" : "employees"}</span>
        </div>
      </div>

      <ul className="grid min-w-[220px] flex-1 gap-0.5">
        {slices.map((d) => (
          <li
            key={d.name}
            tabIndex={0}
            onMouseEnter={() => setActive(d.name)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(d.name)}
            onBlur={() => setActive(null)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 outline-none transition-[background-color,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-brand/40",
              active === d.name && "bg-hover",
              active && active !== d.name && "opacity-60",
            )}
          >
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colorOf(d) }} aria-hidden />
            <span className="t-14 min-w-0 flex-1 truncate text-fg">{d.name}</span>
            <span className="t-12 shrink-0 text-fg-2 tabular-nums max-sm:hidden">{formatMoney(d.payroll, undefined, { compact: true })}</span>
            <span className="t-14 w-6 shrink-0 text-right text-fg tabular-nums">{d.count}</span>
            <span className="t-12 w-9 shrink-0 text-right text-fg-2 tabular-nums">{pct(d.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
