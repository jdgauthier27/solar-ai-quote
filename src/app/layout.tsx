import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
  title: "Solar Wave AI - Get Your Instant Solar Analysis",
  description: "AI-powered solar analysis using Google Solar API. Get accurate solar quotes in minutes with real roof analysis and pricing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Script
          src="https://maps.googleapis.com/maps/api/js?key=AIzaSyCddcFWFRf_zoV5IPv_8FhgquGPxSdmI5M&libraries=places,visualization&loading=async"
          strategy="afterInteractive"
          id="google-maps"
        />
      </body>
    </html>
  );
}
