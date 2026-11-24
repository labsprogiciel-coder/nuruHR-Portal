import type { Metadata } from "next";
import { LeavesPage } from "@/components/pages/admin/leaves-page";

export const metadata: Metadata = { title: "Leaves" };

export default function Page() {
  return <LeavesPage />;
}
