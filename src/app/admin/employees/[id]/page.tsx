import type { Metadata } from "next";
import { EmployeePage } from "@/components/pages/admin/employee-page";
import { createSeed } from "@/lib/seed";

export const metadata: Metadata = { title: "Employee" };

// Employee files live in the browser, so prerender the demo team's pages.
export function generateStaticParams() {
  return createSeed().team.map((e) => ({ id: e.id }));
}

export default async function Page({ params }: PageProps<"/admin/employees/[id]">) {
  const { id } = await params;
  return <EmployeePage id={id} />;
}
