import type { Metadata } from "next";
import { AssetsPage } from "@/components/pages/admin/assets-page";

export const metadata: Metadata = { title: "Equipment" };

export default function Page() {
  return <AssetsPage />;
}
