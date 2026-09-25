import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

const displayFont = Inter_Tight({
  subsets: ["latin", "cyrillic"],
  weight: ["500"],
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
