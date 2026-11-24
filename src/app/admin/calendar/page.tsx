import type { Metadata } from "next";
import { AbsencesPage } from "@/components/pages/admin/absences-page";

export const metadata: Metadata = { title: "Absences" };

export default function Page() {
  return <AbsencesPage />;
}
