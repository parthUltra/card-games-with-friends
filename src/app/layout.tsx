import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "Card Games With Friends",
  description: "Multiplayer card nights — Texas Hold'em tournaments with friends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${syne.variable} antialiased`}>
        <SiteHeader />
        <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-6xl px-4 pb-16 pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
