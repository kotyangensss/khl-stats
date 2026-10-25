import Link from 'next/link';
import type { Game, StandingsTeam, Team } from '@/lib/types';
import { standingsColumns, standingValue } from '@/lib/standings-view';
import { recentTeamForm, neighbouringStandings } from '@/lib/team-overview';
import { formatDayHeading } from '@/lib/format';
import { SiteHeader } from './SiteHeader';
import { TeamLogo } from './TeamLogo';
import { GameStatus } from './GameStatus';
import { TeamMatches } from './TeamMatches';
export function TeamDetailsView({ team, stats, standings = [], upcoming, past }: {
    team: Team;
    stats?: StandingsTeam;
    standings?: StandingsTeam[];
    upcoming: Game[];
    past: Game[];
}) {
    const form = recentTeamForm(past, team.id);
    const neighbours = neighbouringStandings(standings.length ? standings : stats ? [stats] : [], team.id);
    const next = upcoming[0];
    return <><a className="skip-link" href="#team-details">К команде</a><SiteHeader active="standings"/>
    <main id="team-details" className="flow-main team-page team-overview">
      <Link className="flow-back-link" href="/standings">‹ Все команды и таблица</Link>
      <header className="team-identity-card"><div className="team-page-identity"><TeamLogo team={team} size={88} ring={false}/><div><span>КХЛ · Регулярный чемпионат</span><h1>{team.name}</h1><p>{stats ? [stats.conference, stats.division].filter(Boolean).join(' · ') : 'Статистика пока недоступна.'}</p></div></div><Link className="team-calendar-link" href={`/?team=${team.id}#schedule`}>Матчи в расписании ›</Link></header>
      <div className="team-overview-grid"><div className="team-main-column"><div className="team-summary-grid">
        <section className="team-next-match"><div className="team-section-heading"><h2>Ближайший матч</h2><span>КХЛ</span></div>{next ? <Link href={`/game/${next.id}`}><p className="team-next-date">{formatDayHeading(next.date)} · {next.timeFormat ? `${next.timeFormat} МСК` : 'Время уточняется'}</p><div className="team-next-scoreboard"><div><TeamLogo team={next.teamA} size={44} ring={false}/><b>{next.teamA.name}</b></div><div className="team-next-result"><GameStatus game={next}/></div><div><TeamLogo team={next.teamB} size={44} ring={false}/><b>{next.teamB.name}</b></div></div><span className="team-next-open">Страница матча ›</span></Link> : <p className="team-section-empty">Нет предстоящих матчей.</p>}</section>
        <section className="team-form-card"><div className="team-section-heading"><h2>Последние 5 матчей</h2></div>{form.length ? <><div className="team-recent-games">{form.map(entry => <Link key={entry.game.id} className={`team-recent-game team-recent-${entry.result}`} href={`/game/${entry.game.id}`} aria-label={`${entry.result === 'win' ? 'Победа' : entry.result === 'loss' ? 'Поражение' : 'Ничья'} ${entry.ownScore}–${entry.opponentScore}, ${entry.opponent.name}, ${entry.home ? 'дома' : 'в гостях'}`}><strong>{entry.ownScore}–{entry.opponentScore}</strong><TeamLogo team={entry.opponent} size={30} ring={false}/><span>{entry.opponent.name}</span><small>{entry.home ? 'Дома' : 'В гостях'}</small></Link>)}</div><p>Счёт команды указан первым. Последний матч — справа.</p></> : <p className="team-section-empty">Нет прошедших матчей.</p>}</section>
      </div><TeamMatches upcoming={upcoming} past={past}/></div>
      <aside className="team-side-column"><section className="team-table-context"><div className="team-section-heading"><div><h2>Положение в таблице</h2><span>КХЛ · Общий зачёт</span></div><Link href="/standings" aria-label="Вся таблица">›</Link></div>{neighbours.length ? <table><thead><tr><th scope="col"><span className="sr-only">Место</span></th><th scope="col">Команда</th><th scope="col"><abbr title="Сыграно матчей">И</abbr></th><th scope="col"><abbr title="Очки">О</abbr></th></tr></thead><tbody>{neighbours.map(item => <tr key={item.id} className={item.id === team.id ? 'is-selected-team' : ''} aria-current={item.id === team.id ? true : undefined}><td>{item.rank}</td><th scope="row"><Link href={`/team/${item.id}`}><TeamLogo team={item} size={26} ring={false}/>{item.name}</Link></th><td>{item.gamesPlayed}</td><td>{item.points}</td></tr>)}</tbody></table> : <p className="team-section-empty">Статистика пока недоступна.</p>}<Link className="team-table-all" href="/standings">Вся таблица ›</Link></section>
      {stats && <details className="team-season-stats"><summary>Статистика сезона</summary><dl className="team-stat-grid">{standingsColumns.filter(column => column.key !== 'name').map(column => { const average = column.key === 'goalsForAverage' || column.key === 'goalsAgainstAverage'; const value = standingValue(stats, column.key); return <div key={column.key}><dt>{column.key === 'goalsForAverage' ? 'Заброшено за игру' : column.key === 'goalsAgainstAverage' ? 'Пропущено за игру' : column.title}</dt><dd>{average ? Number(value).toFixed(2) : value}</dd></div>; })}</dl></details>}</aside></div>
    </main></>;
}
