import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Oswald, Inter } from "next/font/google";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Расписание КХЛ",
  description: "Календарь и результаты матчей КХЛ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body
        className={`${oswald.variable} ${inter.variable}`}
        style={{ margin: 0, background: "#0B111B", color: "#E7EEF5" }}
      >
        {children}
      </body>
    </html>
  );
}
