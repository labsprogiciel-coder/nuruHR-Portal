import type { Metadata } from "next";
import { PayrollPage } from "@/components/pages/admin/payroll-page";

export const metadata: Metadata = { title: "Payroll" };

export default function Page() {
  return <PayrollPage />;
}
