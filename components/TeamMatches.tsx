"use client";
import { useState } from 'react';
import type { Game } from '@/lib/types';
import { MatchHistory } from './MatchHistory';
export function TeamMatches({ upcoming, past }: {
    upcoming: Game[];
    past: Game[];
}) {
    const [view, setView] = useState(upcoming.length ? 'upcoming' : 'past');
    return <section className="team-games-card"><header><h2>Матчи команды</h2><span>Время московское</span></header><div className="team-games-controls" role="group" aria-label="Матчи команды"><button aria-pressed={view === 'upcoming'} onClick={() => setView('upcoming')}>Предстоящие</button><button aria-pressed={view === 'past'} onClick={() => setView('past')}>Результаты</button></div>
    <div hidden={view !== 'upcoming'}><h3 className="sr-only">Предстоящие матчи</h3><MatchHistory games={upcoming} emptyText="Нет предстоящих матчей."/></div>
    <div hidden={view !== 'past'}><h3 className="sr-only">Прошедшие матчи</h3><MatchHistory games={past} emptyText="Нет прошедших матчей."/></div>
  </section>;
}
