import { ArmchairIcon, DumbbellIcon, GraduationCapIcon, HeartPulseIcon, PiggyBankIcon, type LucideIcon } from "lucide-react";
import { DEFAULT_CURRENCY, formatMoney as formatMoneyIn } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Benefit, EventColor } from "@/lib/types";

export type BenefitCategory = Benefit["category"];

export const CATEGORIES: BenefitCategory[] = ["Health", "Wellness", "Learning", "Financial", "Lifestyle"];

const CATEGORY_STYLE: Record<BenefitCategory, { color: EventColor; icon: LucideIcon }> = {
  Health: { color: "green", icon: HeartPulseIcon },
  Wellness: { color: "pink", icon: DumbbellIcon },
  Learning: { color: "blue", icon: GraduationCapIcon },
  Financial: { color: "orange", icon: PiggyBankIcon },
  Lifestyle: { color: "purple", icon: ArmchairIcon },
};

/** Benefits carry no currency in the store; budgets are in the workspace currency (FCFA). */
export function formatMoney(amount: number): string {
  return formatMoneyIn(amount, DEFAULT_CURRENCY);
}

export function CategoryTile({ category, size = "md" }: { category: BenefitCategory; size?: "sm" | "md" }) {
  const { color, icon: CategoryIcon } = CATEGORY_STYLE[category];
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "md" ? "size-9 rounded-lg" : "size-5 rounded-[6px]",
      )}
      style={{ background: `var(--category-${color}-tint)`, color: `var(--event-${color}-fg)` }}
    >
      <CategoryIcon className={size === "md" ? "size-4" : "size-3"} strokeWidth={2} />
    </span>
  );
}
