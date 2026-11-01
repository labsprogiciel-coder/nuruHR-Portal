import type { IconName } from "@/components/icon";

export type NavItem = { href: string; label: string; icon: IconName; shortcut?: string };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main menu",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "nav-dashboard" },
      { href: "/analytics", label: "Analytics", icon: "nav-analytics" },
    ],
  },
  {
    label: "Personal",
    items: [
      { href: "/personal-details", label: "Personal details", icon: "nav-personal" },
      { href: "/documents", label: "Documents", icon: "nav-documents" },
      { href: "/time-off", label: "Time off", icon: "nav-calendar" },
      { href: "/time-tracking", label: "Time tracking", icon: "nav-time-tracking" },
      { href: "/benefits", label: "Benefits", icon: "nav-benefits" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin", label: "HR overview", icon: "nav-dashboard" },
      { href: "/admin/approvals", label: "Approvals", icon: "status-approved" },
      { href: "/admin/employees", label: "Employees", icon: "nav-personal" },
      { href: "/admin/assets", label: "Equipment", icon: "nav-assets" },
    ],
  },
  {
    label: "Payments",
    items: [
      { href: "/invoice", label: "Invoice", icon: "nav-invoice" },
      { href: "/withdrawal-methods", label: "Withdrawal methods", icon: "nav-withdrawal" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: "settings" };

export const ALL_PAGES: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

/** The nav item for a path; the longest match wins, so /admin/approvals isn't /admin. */
export function activePage(pathname: string): NavItem | undefined {
  return ALL_PAGES.filter((p) => pathname === p.href || pathname.startsWith(p.href + "/")).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}

export function pageTitle(pathname: string): string {
  return activePage(pathname)?.label ?? "Time off";
}
