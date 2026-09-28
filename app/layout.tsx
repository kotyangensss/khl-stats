import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Inter_Tight } from "next/font/google";
import { colors } from "@/lib/theme";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <style>{`
          html, body {
            overflow-anchor: none;
          }
          html, body, * {
            scrollbar-width: thin;
            scrollbar-color: ${colors.borderSoft} transparent;
          }
          html::-webkit-scrollbar,
          body::-webkit-scrollbar,
          *::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          html::-webkit-scrollbar-track,
          body::-webkit-scrollbar-track,
          *::-webkit-scrollbar-track {
            background: transparent;
          }
          html::-webkit-scrollbar-thumb,
          body::-webkit-scrollbar-thumb,
          *::-webkit-scrollbar-thumb {
            background: ${colors.borderSoft};
            border-radius: 999px;
          }
          html::-webkit-scrollbar-thumb:hover,
          body::-webkit-scrollbar-thumb:hover,
          *::-webkit-scrollbar-thumb:hover {
            background: ${colors.accent}66;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
