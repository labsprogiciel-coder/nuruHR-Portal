"use client";

import { MenuIcon } from "lucide-react";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { SidebarBody, SidebarHeader } from "./sidebar";

const useNavSheet = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/**
 * Below `lg` there is no sidebar: each page header starts with this button, which slides the
 * navigation in. A dot shows when there are unread notifications, since the bell is in the sheet.
 */
export function MobileNavButton({ className }: { className?: string }) {
  const setOpen = useNavSheet((s) => s.setOpen);
  const unread = useAppStore((s) => s.notifications.some((n) => !n.read));
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={unread ? "Open navigation, unread notifications" : "Open navigation"}
      className={cn("relative -ml-1.5 size-10 shrink-0 lg:hidden", className)}
      onClick={() => setOpen(true)}
    >
      <MenuIcon className="size-5 text-fg" />
      {unread && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-brand ring-2 ring-surface" />}
    </Button>
  );
}

/** The navigation sheet for phones and tablets. Closes when a link or action in it is used. */
export function MobileNav() {
  const open = useNavSheet((s) => s.open);
  const setOpen = useNavSheet((s) => s.setOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" showCloseButton={false} className="w-[280px] max-w-[85vw] gap-0 border-hairline bg-app p-0 pt-[env(safe-area-inset-top)]">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Pages, search, notifications and your account</SheetDescription>
        {/* React events bubble through portals, so menu items opened from here count too */}
        <div
          className="flex min-h-0 flex-1 flex-col"
          onClickCapture={(ev) => {
            if ((ev.target as HTMLElement).closest("a[href], [data-close-nav]")) setOpen(false);
          }}
        >
          <SidebarHeader />
          <SidebarBody className="pb-[max(0.75rem,env(safe-area-inset-bottom))]" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
