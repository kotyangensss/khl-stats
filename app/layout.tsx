import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const bodyFont = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Inter_Tight({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Расписание КХЛ",
  description: "Календарь и результаты матчей КХЛ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={displayFont.variable}>
      <body
        style={{
          margin: 0,
          background: "#0B111B",
          color: "#E7EEF5",
          fontFamily: "var(--font-body)",
        }}
      >
        {children}
      </body>
    </html>
  );
}
