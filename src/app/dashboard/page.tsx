import type { Metadata } from "next";
import { DashboardPage } from "@/components/pages/dashboard/dashboard-page";

export const metadata: Metadata = { title: "My dashboard" };

export default function Page() {
  return <DashboardPage />;
}
