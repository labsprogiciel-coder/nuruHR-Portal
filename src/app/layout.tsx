import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["600"] });

const SITE_URL = "https://calender-app-design.vercel.app";
const DESCRIPTION =
  "Nuru is the HR portal for small and growing businesses in West Africa: leave that follows the Burkina Faso Labour Code, national holidays, payslips, benefits and payouts in FCFA.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Time off · Nuru", template: "%s · Nuru" },
  description: DESCRIPTION,
  applicationName: "Nuru",
  keywords: ["HR", "time off", "leave management", "congés", "Burkina Faso", "West Africa", "FCFA", "people ops", "Nuru"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Nuru",
    title: "Nuru — HR for West African businesses",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nuru — HR for West African businesses",
    description: DESCRIPTION,
  },
  appleWebApp: { capable: true, title: "Nuru", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8f8" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-palette="gallery-stark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full`}
    >
      <body className="h-full overflow-hidden">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
