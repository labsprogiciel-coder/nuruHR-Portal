import type { Metadata } from "next";
import { EmployeesPage } from "@/components/pages/admin/employees-page";

export const metadata: Metadata = { title: "Employees" };

export default function Page() {
  return <EmployeesPage />;
}
