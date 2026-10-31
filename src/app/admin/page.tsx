import type { Metadata } from "next";
import { AdminOverviewPage } from "@/components/pages/admin/overview-page";

export const metadata: Metadata = { title: "HR overview" };

export default function Page() {
  return <AdminOverviewPage />;
}
