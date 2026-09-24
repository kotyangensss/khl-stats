import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Расписание КХЛ",
  description: "Календарь и результаты матчей КХЛ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
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
