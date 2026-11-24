import type { Metadata } from "next";
import { TeamCalendarPage } from "@/components/pages/admin/team-calendar-page";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return <TeamCalendarPage />;
}
