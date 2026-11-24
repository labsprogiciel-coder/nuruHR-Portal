import type { Metadata } from "next";
import { RequestsPage } from "@/components/time-off/requests-page";

export const metadata: Metadata = { title: "Leave requests" };

export default function Page() {
  return <RequestsPage />;
}
