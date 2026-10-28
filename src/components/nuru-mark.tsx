import { cn } from "@/lib/utils";

/** The Nuru sprout on its tile. Mirrors src/app/icon.svg; switches to the dark tile in dark mode. */
export function NuruMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
      <rect width="1024" height="1024" rx="230" className="fill-[#1f6f5c] dark:fill-[#0f2a24]" />
      <circle cx="512" cy="300" r="63" fill="#f2a93b" />
      <path d="M259 332C420 332 506 424 512 560V597C364 590 259 486 259 332Z" className="fill-white dark:fill-[#5fb89a]" />
      <path d="M765 332C604 332 518 424 512 560V597C660 590 765 486 765 332Z" fill="#d8ebe3" />
      <rect x="486" y="555" width="52" height="232" rx="26" className="fill-white dark:fill-[#5fb89a]" />
    </svg>
  );
}
