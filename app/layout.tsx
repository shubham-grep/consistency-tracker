import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steady — Consistency Tracker",
  description: "Turn small, repeatable actions into visible momentum with private, browser-only goals, check-ins, streaks, and milestones.",
  applicationName: "Steady",
  keywords: ["consistency tracker", "goal tracker", "habit tracker", "streak calendar"],
  openGraph: {
    title: "Steady — Consistency Tracker",
    description: "Small steps, visible momentum. A private consistency tracker that lives in your browser.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Steady — Consistency Tracker",
    description: "Small steps, visible momentum.",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4eddf",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
