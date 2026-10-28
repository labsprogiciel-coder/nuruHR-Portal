import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nuru",
    short_name: "Nuru",
    description: "HR for West African businesses: time off, holidays, payslips and payouts in FCFA.",
    start_url: "/time-off",
    display: "standalone",
    background_color: "#f8f8f8",
    theme_color: "#1f6f5c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
