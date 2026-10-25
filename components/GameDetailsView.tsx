import Link from "next/link";
import type { Game, StandingsTeam, Team } from "@/lib/types";
import { formatDayHeading, overtimeLabel } from "@/lib/format";
import { SiteHeader } from "./SiteHeader";
import { TeamLogo } from "./TeamLogo";
import { TeamStatsLine } from "./TeamStatsLine";
import { GameStatus } from "./GameStatus";
import { MatchHistory } from "./MatchHistory";
import { TeamComparison } from "./TeamComparison";

type GoalEvent = { period?: number | null; time?: string; team?: string; scorer?: string; assists?: string[]; score?: string };
type Props = {
  game: Game;
  stage?: { type: string; name: string | null } | null;
  liveClock?: string | null;
  standings: Record<number, StandingsTeam>;
  recentA: Game[];
  recentB: Game[];
};

function periodName(period: number | null | undefined, playoff: boolean): string {
  if (period == null) return "Период не указан";
  if (period <= 3) return `${period}-й период`;
  if (playoff) return `${period - 3}-й овертайм`;
  return period === 4 ? "Овертайм" : "Буллиты";
}

function ScoreClub({ team, stats, side }: { team: Team; stats?: StandingsTeam; side: string }) {
  return <Link href={`/team/${team.id}`} className="score-club">
    <span className="club-side">{side}</span>
    <TeamLogo team={team} size={100} ring={false} />
    <strong>{team.name}</strong>
    <TeamStatsLine stats={stats} compact showRank />
  </Link>;
}

export function GameDetailsView({ game, stage, liveClock, standings, recentA, recentB }: Props) {
  const playoff = stage?.type === "playoff";
  const periods = Array.isArray(game.periodScores) ? game.periodScores as string[] : [];
  const events = Array.isArray(game.liveEvents) ? game.liveEvents as GoalEvent[] : [];
  const intermission = /перерыв|intermission|break/i.test(game.liveStatus ?? "");
  const displayGame = { ...game, liveClock: intermission ? null : liveClock ?? game.liveClock };
  const overtime = overtimeLabel(game.overtime);
  return <>
    <a className="skip-link" href="#match-details">К матчу</a><SiteHeader active={null} />
    <main id="match-details" className="flow-main details-page game-details-page">
      <div className="details-breadcrumb"><Link href="/#schedule">← Расписание</Link><span>{stage?.name || "Регулярный чемпионат КХЛ"}</span></div>
      <h1 className="sr-only">{game.teamA.name} — {game.teamB.name}</h1>
      <header className="match-heading">
        <time dateTime={game.date}>{formatDayHeading(game.date)}</time>
        <span>{game.timeFormat ? `${game.timeFormat} МСК` : "Время начала уточняется"}</span>
        {(game.venue || game.arena?.city) && <span>{game.venue || game.arena?.city}</span>}
      </header>
      <section className={`scoreboard ${game.status === "SCHEDULED" && !game.timeFormat ? "time-pending" : ""}`} aria-label="Команды и счёт">
        <ScoreClub team={game.teamA} stats={standings[game.teamA.id]} side="Хозяева" />
        <div className="match-score"><GameStatus game={displayGame} />{game.status === "FINISHED" && overtime && <p className="match-decision">{overtime === "ОТ" ? "Победа в овертайме" : overtime === "Б" ? "Победа по буллитам" : overtime}</p>}</div>
        <ScoreClub team={game.teamB} stats={standings[game.teamB.id]} side="Гости" />
      </section>
      {periods.length > 0 && <dl className="period-scores">{periods.map((score, index) => <div key={index}><dt>{periodName(index + 1, playoff)}</dt><dd>{score}</dd></div>)}</dl>}

      {(events.length > 0 || game.status === "FINISHED") && <section className="goal-section" aria-labelledby="goals-heading">
        <div className="details-section-heading"><h2 id="goals-heading">Ход матча</h2><span>Голы и передачи</span></div>
        {!events.length ? <p className="details-empty">Данные об авторах голов пока не предоставлены источником.</p> : <ol className="goal-list">
          {events.map((event, index) => {
            const teamName = event.team === "home" ? game.teamA.name : event.team === "away" ? game.teamB.name : event.team;
            return <li key={`${event.period}-${event.time}-${index}`}>
              <div className="goal-time"><strong>{event.time ?? "—"}</strong><span>{periodName(event.period, playoff)}</span></div>
              <div className="goal-scorer"><strong>{event.scorer || "Автор не указан"}</strong><span>{teamName || "Команда не указана"}</span>{event.assists?.length ? <small>Передачи: {event.assists.join(", ")}</small> : null}</div>
              <strong className="goal-score">{event.score || "—"}</strong>
            </li>;
          })}
        </ol>}
      </section>}

      {(standings[game.teamA.id] || standings[game.teamB.id]) && <details className="match-comparison" open={game.status === "SCHEDULED"}>
        <summary>Сравнение команд <span>Показатели в чемпионате</span></summary>
        <TeamComparison teams={[game.teamA, game.teamB]} standings={standings} />
      </details>}

      {game.status !== "FINISHED" && <div className="details-columns">
        {[{ team: game.teamA, games: recentA }, { team: game.teamB, games: recentB }].map(({ team, games }) => <section key={team.id}>
          <div className="details-section-heading"><h2>Последние матчи</h2><Link href={`/team/${team.id}`}>{team.name} ↗</Link></div>
          <MatchHistory games={games} emptyText="Пока нет сыгранных матчей." />
        </section>)}
      </div>}
      <footer className="details-footer"><Link href="/#schedule">Все матчи</Link><Link href="/standings">Турнирная таблица ↗</Link></footer>
    </main>
  </>;
}
