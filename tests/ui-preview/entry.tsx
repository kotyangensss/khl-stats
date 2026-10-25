import { createRoot } from "react-dom/client";
import HomeBrowser from "../../app/HomeBrowser";
import { StandingsBrowser } from "../../app/standings/StandingsBrowser";
import { SiteHeader } from "../../components/SiteHeader";
import { games, standings } from "./fixture";

const params = new URLSearchParams(location.search);
const empty = params.has("empty");
const nearest = { day: "today" as const, date: "2026-10-24", games: empty ? [] : games.slice(0, 2) };
const data = { scope: "upcoming" as const, month: "1026", games: empty ? [] : games.slice(0, 3) };
window.fetch = async (input) => {
  const url = new URL(String(input), location.href);
  const response = url.pathname === "/api/standings" ? standings : url.pathname.endsWith("nearest") ? nearest : { ...data, games: empty ? [] : url.searchParams.get("scope") === "past" ? [games[3]] : data.games };
  return new Response(JSON.stringify(response), { headers: { "content-type": "application/json" } });
};
createRoot(document.getElementById("root")!).render(params.get("view") === "standings" ? <><SiteHeader active="standings" /><main className="standings-page"><header className="standings-heading"><div><p className="eyebrow">Регулярный чемпионат КХЛ · тестовые данные</p><h1>РАСКЛАД<br /><span>СИЛ.</span></h1></div><p>4 команды.<br />Каждое очко имеет вес.</p></header><StandingsBrowser standings={empty ? { ...standings, overall: { ...standings.overall, teams: [] }, conferenceGroups: [], groups: [] } : standings} /></main></> : <HomeBrowser initialDate="2026-10-24" initialTeamId={null} initialData={data} initialStandings={standings} />);
