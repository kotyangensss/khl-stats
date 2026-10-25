import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CompanionProvider } from "@/components/companion/Companion";
import { colors } from "@/lib/theme";
import { localDemoEnabled } from "@/lib/local-demo";
import "./globals.css";
import "./details.css";
import "./material.css";
import "./material-base.css";
import "./companion.css";

export const metadata: Metadata = {
  title: "Расписание КХЛ",
  description: "Календарь и результаты матчей КХЛ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
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
      <body className="hockey-app"><CompanionProvider>{children}</CompanionProvider>{localDemoEnabled() && <aside className="local-demo-note" role="status">Локальный режим · тестовые матчи и счёт</aside>}</body>
    </html>
  );
}
