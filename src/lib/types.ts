import type { Payslip } from "./payroll";

export type EventColor = "green" | "purple" | "cyan" | "orange" | "pink" | "blue";

/** Dates are local calendar days stored as "YYYY-MM-DD"; times are minutes from midnight. */
export type CalEvent = {
  id: string;
  title: string;
  date: string;
  start: number;
  end: number;
  allDay: boolean;
  color: EventColor;
  note?: string;
  location?: string;
  requestId?: string;
};

export type LeaveStatus = "approved" | "pending" | "declined" | "cancelled";

export type LeaveType = "Annual leave" | "Sick" | "Family event" | "Maternity" | "Half-day leave" | "Personal";

export type LeaveRequest = {
  id: string;
  status: LeaveStatus;
  type: LeaveType;
  /** Human label shown in the table, e.g. "2 days 4 hours" */
  duration: string;
  /** Days counted against the allowance */
  days: number;
  from: string;
  to: string;
  allDay: boolean;
  start?: number;
  end?: number;
  notes: string;
  submittedAt: string;
};

export type Holiday = {
  id: string;
  date: string;
  name: string;
  /** Islamic holidays: the date is confirmed by moon sighting and can move by a day */
  lunar?: boolean;
};

export type Profile = {
  name: string;
  email: string;
  initials: string;
  phone: string;
  jobTitle: string;
  department: string;
  manager: string;
  location: string;
  startDate: string;
  birthday: string;
  address: string;
  emergencyContact: string;
  bio: string;
};

export type Settings = {
  weekStartsOn: 0 | 1;
  timeFormat: "24h" | "12h";
  dayStartHour: number;
  /** Paid leave per full year of service (Labour Code minimum: 30 calendar days) */
  contractDays: number;
  carryoverDays: number;
  showWeekends: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

export type DocCategory = "Contract" | "Payslip" | "Policy" | "Medical" | "Tax" | "Other";

export type DocumentFile = {
  id: string;
  name: string;
  category: DocCategory;
  size: number;
  uploadedAt: string;
  /** data: URL for files uploaded in this browser (small files only) */
  dataUrl?: string;
  starred?: boolean;
};

export type TimeEntry = {
  id: string;
  date: string;
  project: string;
  task: string;
  minutes: number;
  billable: boolean;
};

export type Timer = { running: boolean; startedAt: number | null; project: string; task: string };

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export type InvoiceItem = { id: string; description: string; quantity: number; rate: number };

export type Invoice = {
  id: string;
  number: string;
  client: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  notes: string;
  currency: string;
};

export type WithdrawalKind = "bank" | "paypal" | "wise" | "card";

export type WithdrawalMethod = {
  id: string;
  kind: WithdrawalKind;
  label: string;
  holder: string;
  /** Masked tail only, never a full number */
  last4: string;
  currency: string;
  isDefault: boolean;
  addedAt: string;
};

export type Benefit = {
  id: string;
  name: string;
  provider: string;
  category: "Health" | "Wellness" | "Learning" | "Financial" | "Lifestyle";
  description: string;
  budget: number;
  used: number;
  enrolled: boolean;
  renewsOn: string;
};

export type Workspace = { id: string; name: string };

/** CDI: permanent · CDD: fixed-term · Apprentice/Intern: training contracts */
export type ContractType = "CDI" | "CDD" | "Apprentice" | "Intern";

/**
 * An employee's HR file, as the admin sees it. The signed-in user is the employee with id
 * "emp-me": their identity comes from `profile` and their requests from `requests`.
 */
export type Employee = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  manager: string;
  location: string;
  startDate: string;
  contract: ContractType;
  /** CDD, apprentice and intern contracts end on this date */
  contractEnd?: string;
  /** Last day of the trial period (période d'essai), while it runs */
  trialEnd?: string;
  /** Gross monthly salary in FCFA */
  monthlySalary: number;
  cnssNumber: string;
  dependents: number;
  carryoverDays: number;
  /** Executive staff (cadre): a smaller flat deduction for professional expenses in IUTS */
  executive?: boolean;
  /** Set once HR records that the person is leaving; they stay on file as a former employee */
  departure?: Departure;
  /** Allowances paid every month on top of the base salary, in FCFA */
  allowances?: Partial<Record<AllowanceKind, number>>;
};

export type AllowanceKind = "housing" | "transport" | "function" | "other";

/** What changes from one month to the next for one employee: entered by HR before validating. */
export type PayrollInput = {
  bonus?: number;
  /** Overtime hours paid at the first premium (+15%) */
  overtime15?: number;
  /** Overtime hours paid at the higher premium (+35%) */
  overtime35?: number;
  /** Days of unpaid absence */
  absenceDays?: number;
  note?: string;
};

/** Money lent against future salary, withheld in equal monthly instalments. */
export type Advance = {
  id: string;
  employeeId: string;
  amount: number;
  /** Day it was handed over, YYYY-MM-DD */
  date: string;
  /** Withheld from each payslip until repaid */
  installment: number;
  /** First month repaid, YYYY-MM */
  firstMonth: string;
  note?: string;
};

export type DepartureReason = "Resignation" | "End of contract" | "Dismissal" | "Mutual agreement" | "Retirement" | "Other";

export type Departure = {
  /** Last day worked (YYYY-MM-DD); from the next day they count as a former employee */
  date: string;
  reason: DepartureReason;
  note?: string;
  recordedAt: string;
};

/** A month's payroll once HR has acted on it; months with no entry are drafts. */
export type PayrollRun = {
  month: string;
  status: "validated" | "paid";
  validatedAt: string;
  paidAt?: string;
  /** Payslips frozen at validation, by employee id, so later raises don't rewrite a closed month */
  lines?: Record<string, Payslip>;
};

export type AssetCategory = "Laptop" | "Phone" | "Tablet" | "Vehicle" | "Motorbike" | "Other";

/** Company equipment. Unassigned assets (no employeeId) are in stock, or in repair. */
export type Asset = {
  id: string;
  category: AssetCategory;
  /** Make and model, e.g. "Dell Latitude 5440" */
  name: string;
  /** Serial number, IMEI or registration plate */
  identifier: string;
  employeeId: string | null;
  /** Date it was handed to the current holder */
  assignedOn?: string;
  status: "in-use" | "in-stock" | "in-repair";
  condition: "New" | "Good" | "Fair" | "Damaged";
  /** Purchase value in FCFA */
  value: number;
  purchasedOn: string;
  /** A problem the holder reported, waiting for the admin */
  issue?: { note: string; reportedAt: string };
};

/** A colleague's leave request. The signed-in user's own requests live in `requests`. */
export type TeamRequest = LeaveRequest & { employeeId: string };

export type AppState = {
  version: number;
  workspaceId: string;
  workspaces: Workspace[];
  events: CalEvent[];
  requests: LeaveRequest[];
  holidays: Holiday[];
  profile: Profile;
  settings: Settings;
  notifications: AppNotification[];
  documents: DocumentFile[];
  timeEntries: TimeEntry[];
  timer: Timer;
  invoices: Invoice[];
  withdrawalMethods: WithdrawalMethod[];
  benefits: Benefit[];
  team: Employee[];
  teamRequests: TeamRequest[];
  assets: Asset[];
  /** Keyed by month, "YYYY-MM" */
  payrollRuns: Record<string, PayrollRun>;
  /** Bonus, overtime and absence by month ("YYYY-MM"), then employee id */
  payrollInputs: Record<string, Record<string, PayrollInput>>;
  advances: Advance[];
};
