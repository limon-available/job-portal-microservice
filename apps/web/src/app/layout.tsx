import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: { default: "HireHeaven | Find work that fits", template: "%s | HireHeaven" },
  description: "Discover thoughtful career opportunities and build your next chapter with HireHeaven.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><ThemeProvider><QueryProvider>{children}</QueryProvider></ThemeProvider></body></html>;
}
