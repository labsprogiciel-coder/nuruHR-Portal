import type { IconName } from "@/components/icon";

export type NavItem = { href: string; label: string; icon: IconName; shortcut?: string };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * The signed-in person's own pages (their leave, documents, benefits…) and the freelancer
 * pages. Employees use the mobile app for these, so the portal hides them: the pages still
 * exist and open by address, they are only left out of the sidebar and the search. Set this
 * to true to bring them back.
 */
export const SHOW_MY_SPACE = false;

const HR_GROUP: NavGroup = {
  label: "HR",
  items: [
    { href: "/admin", label: "HR overview", icon: "nav-dashboard" },
    { href: "/admin/approvals", label: "Approvals", icon: "status-approved" },
    { href: "/admin/calendar", label: "Absences", icon: "nav-calendar" },
    { href: "/admin/employees", label: "Employees", icon: "nav-personal" },
    { href: "/admin/payroll", label: "Payroll", icon: "nav-withdrawal" },
    { href: "/admin/assets", label: "Equipment", icon: "nav-assets" },
  ],
};

const MY_SPACE_GROUPS: NavGroup[] = [
  {
    label: "My space",
    items: [
      { href: "/dashboard", label: "My dashboard", icon: "nav-dashboard" },
      { href: "/time-off", label: "Time off", icon: "nav-calendar" },
      { href: "/time-off/requests", label: "Leave requests", icon: "request-time-off" },
      { href: "/time-tracking", label: "Time tracking", icon: "nav-time-tracking" },
      { href: "/personal-details", label: "Personal details", icon: "nav-personal" },
      { href: "/documents", label: "Documents", icon: "nav-documents" },
      { href: "/benefits", label: "Benefits", icon: "nav-benefits" },
      { href: "/analytics", label: "Analytics", icon: "nav-analytics" },
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

/** What the sidebar shows: the portal is the admin's tool, so HR comes first. */
export const NAV_GROUPS: NavGroup[] = [HR_GROUP, ...(SHOW_MY_SPACE ? MY_SPACE_GROUPS : [])];

/** Where the app opens. */
export const HOME = "/admin";

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: "settings" };

/** The pages offered in the sidebar and the search. */
export const VISIBLE_PAGES: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

/** Every page, hidden ones included, so a hidden page opened by address still gets its title. */
export const ALL_PAGES: NavItem[] = [...[HR_GROUP, ...MY_SPACE_GROUPS].flatMap((g) => g.items), SETTINGS_ITEM];

/** The nav item for a path; the longest match wins, so /admin/approvals isn't /admin. */
export function activePage(pathname: string): NavItem | undefined {
  return ALL_PAGES.filter((p) => pathname === p.href || pathname.startsWith(p.href + "/")).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}

export function pageTitle(pathname: string): string {
  return activePage(pathname)?.label ?? "HR overview";
}
