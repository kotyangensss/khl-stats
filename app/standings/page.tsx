import Link from "next/link";
import { StandingsBrowser } from "./StandingsBrowser";
import { getStandings } from "@/lib/standings";
import { colors } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const standings = await getStandings();

  return (
    <main style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: "clamp(1.25rem, 5vw, 3rem)" }}>
      <Link href="/" style={{ color: colors.muted, fontFamily: "var(--font-display)", fontSize: "0.9rem", textDecoration: "none" }}>
        ← Расписание
      </Link>
      <header style={{ margin: "2.5rem 0 2rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 5vw, 3rem)", margin: 0 }}>
          Турнирная таблица КХЛ
        </h1>
        <p style={{ color: colors.muted, fontFamily: "var(--font-body)", margin: "0.6rem 0 0" }}>
          Регулярный чемпионат
        </p>
      </header>
      <StandingsBrowser standings={standings} />
    </main>
  );
}
