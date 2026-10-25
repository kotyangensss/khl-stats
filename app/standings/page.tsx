import { SiteHeader } from "@/components/SiteHeader";
import { StandingsBrowser } from "./StandingsBrowser";
import { getStandingsSafe } from "@/lib/standings";

export const revalidate = 60;

export default async function StandingsPage() {
  const standings = await getStandingsSafe();

  return (
    <><a className="skip-link" href="#standings">К таблице</a><SiteHeader active="standings" />
    <main id="standings" className="flow-main league-page">
      <header className="league-heading"><span>КХЛ · Регулярный чемпионат</span><h1>Турнирная таблица</h1><p>Положение команд и статистика сезона</p></header>
      <StandingsBrowser standings={standings} />
    </main></>
  );
}
