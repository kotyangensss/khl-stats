import Link from "next/link";
import { StandingsBrowser } from "./StandingsBrowser";
import { getStandingsSafe } from "@/lib/standings";
import { colors } from "@/lib/theme";

export const revalidate = 60;

export default async function StandingsPage() {
  const standings = await getStandingsSafe();

  return (
    <main style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: "clamp(1.25rem, 5vw, 3rem)" }}>
      <Link href="/" style={{ color: colors.muted, fontFamily: "var(--font-display)", fontSize: "0.9rem", textDecoration: "none" }}>
        ← Расписание
      </Link>
      <header style={{ margin: "2.5rem 0 2rem", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1rem, 5vw, 2rem)", margin: 0 }}>
          Турнирная таблица КХЛ
        </h1>
      </header>
      <StandingsBrowser standings={standings} />
    </main>
  );
}
