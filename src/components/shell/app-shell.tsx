import { GlobalDialogs } from "@/components/dialogs/global-dialogs";
import { GlobalSearch } from "./global-search";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

/** Sidebar and page. No top bar: each page has its own header, which names it. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden bg-app pt-[env(safe-area-inset-top)]">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      <MobileNav />
      <GlobalSearch />
      <GlobalDialogs />
      <KeyboardShortcuts />
    </div>
  );
}
