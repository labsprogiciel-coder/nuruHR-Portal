import Image from "next/image";
import { BanknoteIcon, LandmarkIcon } from "lucide-react";
import { PAYOUT_METHODS } from "@/lib/payouts";
import type { PayoutMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The providers' own marks, in /public/payment. Bank transfer and cash have no brand: they get an icon. */
const LOGOS: Partial<Record<PayoutMethod, string>> = {
  wave: "/payment/wave.png",
  "orange-money": "/payment/orange-money.png",
  "pi-spi": "/payment/pi-spi.png",
};

/** A payment method's logo as a small rounded tile. Decorative: the method's name is always shown beside it. */
export function PayoutLogo({ method, size = 20, className }: { method: PayoutMethod; size?: number; className?: string }) {
  const src = LOGOS[method];
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0", method === "pi-spi" ? "" : "rounded-[5px]", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const Glyph = method === "bank" ? LandmarkIcon : BanknoteIcon;
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-[5px] border border-hairline bg-app text-icon", className)}
      style={{ width: size, height: size }}
    >
      <Glyph style={{ width: size * 0.6, height: size * 0.6 }} />
    </span>
  );
}

/** Logo and name together, for lists and tables. */
export function PayoutName({ method, className }: { method: PayoutMethod; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <PayoutLogo method={method} />
      <span className="truncate">{PAYOUT_METHODS[method].label}</span>
    </span>
  );
}
