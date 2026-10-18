import type { Metadata } from "next";
import { Anton, Inter_Tight } from "next/font/google";
import "./globals.css";
import AppNav from "@/components/AppNav";

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Splitr",
  description:
    "Split shared expenses fairly with your roommates and friends. Track who paid, who owes, and settle up with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${interTight.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink antialiased">
        <AppNav />
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-10 pb-32 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
