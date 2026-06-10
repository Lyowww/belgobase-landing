import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BelgoBase — Targeted B2B Leads from 2M+ Belgian Companies",
  description:
    "Get custom B2B leads lists built from official Belgian KBO data. GDPR-safe, pay-per-list, delivered in hours. Request 30 free sample leads today.",
  keywords: [
    "Belgian B2B leads",
    "KBO company data",
    "Belgium lead generation",
    "B2B prospecting Belgium",
    "GDPR compliant leads",
  ],
  openGraph: {
    title: "BelgoBase — Targeted B2B Leads from 2M+ Belgian Companies",
    description:
      "Custom B2B leads lists from 2M+ Belgian companies. No contracts. Pay per list only.",
    type: "website",
    locale: "en_BE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} scroll-smooth`}
    >
      <body className="min-h-screen bg-white font-sans text-deep-navy antialiased">
        {children}
      </body>
    </html>
  );
}
