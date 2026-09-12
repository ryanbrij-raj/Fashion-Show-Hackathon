import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { NavBar } from "@/components/editorial/NavBar";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Jerry — Your closet. Your style. Right now.",
  description:
    "AI styling that starts with what you already own. Rescue forgotten pieces, decode any style, and see your wardrobe through Gemini and Vonage Video.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
