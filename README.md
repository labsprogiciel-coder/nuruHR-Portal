# Nuru

**Nuru** is an HR portal for small and growing private-sector businesses in West
Africa. This prototype is set up for **Burkina Faso**: leave follows the Labour
Code, the calendar carries the national holidays, and money is shown in **FCFA**
(West African CFA franc, XOF).

It is frontend-only — there is no backend; data persists to `localStorage`.
The UI started from the Kargul Studio "Dashboard – calendar" design prototype.

## Burkina Faso rules

Leave rules live in `src/lib/labour-code.ts` (Loi n° 028-2008/AN portant Code du
travail) and are applied in `src/lib/leave.ts`:

- **Annual leave** — 2.5 calendar days per month of service, 30 days a year.
  Counted in calendar days (weekends included); public holidays inside a request
  don't count. +2 / +4 / +6 days after 20 / 25 / 30 years' seniority. The hiring
  year is pro-rated by full months of service. Settings won't go below 30.
- **Family events** — not deducted up to 10 working days a year; anything beyond
  comes off the annual allowance.
- **Sick leave** — not deducted; needs a medical certificate.
- **Maternity** — 14 weeks (prefilled), not deducted.
- **Public holidays** — 2026 and 2027 in `src/lib/seed.ts`. Korité, Tabaski and
  Maouloud are flagged `lunar`: their dates are the expected ones and are
  confirmed by moon sighting, so check them against the official announcement.

Amounts are formatted by `src/lib/money.ts`: `1 250 000 FCFA` (whole francs,
spaced thousands); other currencies keep their symbol.

## Stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript**
- **Tailwind CSS v4** with design tokens mapped from the Figma variables
- **shadcn/ui** (Radix primitives) themed to the design
- **Zustand** for state (`persist` middleware → `localStorage`)
- **next-themes** for dark mode, **Sonner** for toasts, **cmdk** for the command palette

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. To return to the exact design state, use
**Settings → Data → Reset demo data** (or clear site data).

## What works

- **Calendar** — week / day / month views; drag on empty space to create, drag
  events to move (across days), drag the bottom edge to resize; overlapping
  events lay out side by side; all-day lane with public holidays; live now-line;
  origin-aware details popover.
- **Time off** — request dialog that counts calendar or working days by leave
  type (never public holidays) and shows the balance after the request; stats computed from your
  requests and allowance; requests table with search, filters, sorting, details,
  edit/cancel/delete, and a manager approve/decline preview.
- **Shell** — workspace switcher, ⌘K search across pages/events/requests/
  documents/invoices, notifications, help menu, dark mode, account menu.
- **Keyboard** — `⌘K` search, `N` new event, `R` request time-off, `T` today,
  `←/→` previous/next, `D/W/M` views, `?` shortcuts.
- **Admin (HR)** — HR overview (headcount, approvals waiting, who's off, monthly
  payroll in FCFA, contract and trial-period ends), an approvals inbox across the
  team with each request's effect on the balance under the Labour Code, an
  employee directory with filters, and an employee file (contract, CNSS number,
  salary, seniority, leave balance and history). The signed-in employee is part
  of the team, so approving their own request here updates their Time off page.
- **Employee management** — add an employee (identity, job, contract type and
  end date, trial period, salary with a live net-pay estimate, dependents,
  executive status, CNSS number, carried-over leave), edit any file (editing your
  own also updates your profile), and record a departure: last day, reason, a
  "to settle" summary (seniority, leave not taken with an estimated payout,
  equipment to take back) and a printable French work certificate (certificat de
  travail). People who left move to a Former tab and drop out of payroll after
  their last month; upcoming departures show on the HR overview.
- **Payroll (Burkina Faso)** — a monthly run for the whole team: base salary,
  recurring allowances (housing, transport, function, other) set on each employee,
  and the month's bonus, overtime (+15% / +35% hours) and unpaid absence entered
  per person while the month is a draft. Then employee CNSS (5.5% of the whole
  gross, capped at 800 000 FCFA), IUTS (after the exempt part of allowances, the
  flat deduction on base salary and the family reduction), net salary, salary
  advance repayments and the net to pay, plus employer CNSS (16%) and cost. Each
  payslip prints as a French bulletin de paie, and the month exports as a payroll
  summary and CNSS and IUTS declaration files (CSV, in French). Runs go draft →
  validated (figures frozen) → paid, and paying drops the signed-in employee's
  payslip into Documents. Salary advances are given from the employee file and
  withheld in monthly instalments, oldest first. Rates live in
  `src/lib/payroll.ts`; the IUTS scale, allowance exemptions and overtime premiums
  still need checking with an accountant.
- **Equipment** — employees see the company property registered to them
  (laptop, phone, tablet, vehicle, motorbike) on their dashboard and can report
  a problem with it. Admins get an equipment list (in use, in stock, in repair,
  problems; values in FCFA) to add items, assign or reassign them, return them
  to stock and track repairs, and each employee file lists what that person holds.
- **Other pages** — Dashboard, Analytics, Personal details, Documents, Time
  tracking, Benefits, Invoice, Withdrawal methods, Settings.

## Project layout

```
src/
  app/                 routes (one folder per sidebar page)
  components/
    ui/                shadcn/ui primitives, themed
    shell/             title bar, sidebar, search, notifications, shortcuts
    calendar/          header, time grid, all-day row, month view, popover
    time-off/          stats panel, requests table, status badge
    dialogs/           app-wide dialogs (request, event, details, holidays…)
    pages/             page bodies for the secondary routes
  stores/              Zustand stores (app data, calendar view, overlays)
  hooks/               client-only "today"/"now"
  lib/                 types, date helpers, leave rules, seed data
```

The seed in `src/lib/seed.ts` opens on the week of Nov 8–14, 2026 with Tue Nov 10
selected, for an employee in Ouagadougou: 30 days a year + 4 carried over, 16.5
available, 2 pending requests, 16 national holidays.

## License

[MIT](LICENSE) © 2026 Kargul Studio
