import type { Metadata, Viewport } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { Providers } from "@/components/ui/Providers";
import { BottomNav } from "@/components/ui/NavLinks";

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

export const viewport: Viewport = {
  themeColor: "#0b0f0d",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${syne.variable} antialiased`}>
        <Providers>
          <SiteHeader />
          <main className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl px-4 pb-16 pt-6 md:pt-10">
            {children}
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
