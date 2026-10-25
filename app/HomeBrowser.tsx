"use client";
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Game, StandingsData } from '@/lib/types';
import { filterSchedule, monthFromDay, moscowToday, shiftDay, validDay } from '@/lib/material-schedule';
import { parseTimeMinutes } from '@/lib/schedule';
import { SiteHeader } from '@/components/SiteHeader';
import { ScheduleGameRow } from '@/components/ScheduleGameRow';
import { TeamLogo } from '@/components/TeamLogo';
type GamesResponse = {
    games: Game[];
    month: string;
    scope: 'all' | 'past' | 'upcoming';
};
type Props = {
    initialData: GamesResponse;
    initialStandings: StandingsData;
    initialDate: string;
    initialTeamId: number | null;
};
const label = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
export default function HomeBrowser({ initialData, initialStandings, initialDate, initialTeamId }: Props) {
    const [today] = useState(() => moscowToday());
    const [start, setStart] = useState(initialDate);
    const [selected, setSelected] = useState(initialDate);
    // Scrolling changes the highlighted date without removing a deliberately
    // opened empty day above the viewport and shifting the document.
    const [openedDay, setOpenedDay] = useState(initialDate);
    const [teamId, setTeamId] = useState<number | null>(initialTeamId);
    const [live, setLive] = useState(false);
    const [cache, setCache] = useState<Record<string, Game[]>>({ [initialData.month]: initialData.games });
    const [standings, setStandings] = useState(initialStandings.teamsById);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [retry, setRetry] = useState(0);
    const [query, setQuery] = useState('');
    const [menu, setMenu] = useState(false);
    const [active, setActive] = useState(0);
    const dropdown = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const pendingScroll = useRef<string | null>(null);
    const scrollGuard = useRef(0);
    const days = useMemo(() => Array.from({ length: 14 }, (_, i) => shiftDay(start, i)), [start]);
    const months = useMemo(() => [...new Set(days.map(monthFromDay))].join(','), [days]);
    const teams = useMemo(() => Object.values(standings).sort((a, b) => a.name.localeCompare(b.name, 'ru')), [standings]);
    const currentTeam = teams.find(team => team.id === teamId);
    const options = useMemo(() => [{ id: null, name: 'Все команды', logoUrl: null }, ...teams].filter(team => team.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru'))), [teams, query]);
    const games = useMemo(() => filterSchedule(Object.values(cache).flat(), teamId, live).sort((a, b) => a.date.localeCompare(b.date) || parseTimeMinutes(a.timeFormat) - parseTimeMinutes(b.timeFormat)), [cache, teamId, live]);
    const byDay = useMemo(() => { const map = new Map<string, Game[]>(); for (const game of games) {
        const day = game.date.slice(0, 10);
        map.set(day, [...(map.get(day) ?? []), game]);
    } return map; }, [games]);
    const visibleDays = days.filter(day => byDay.has(day) || day === openedDay);
    function updateUrl(day: string, team: number | null) {
        const url = new URL(window.location.href);
        url.searchParams.set('date', day);
        url.searchParams.set('month', monthFromDay(day));
        url.searchParams.delete('tab');
        if (team === null)
            url.searchParams.delete('team');
        else
            url.searchParams.set('team', String(team));
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    function chooseDay(day: string) {
        setSelected(day);
        setOpenedDay(day);
        pendingScroll.current = day;
        scrollGuard.current = Date.now() + 1000;
        updateUrl(day, teamId);
        const target = document.getElementById('day-' + day);
        if (target) {
            target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
            pendingScroll.current = null;
        }
        if (!days.includes(day))
            setStart(day);
    }
    function chooseTeam(id: number | null) {
        setTeamId(id);
        setMenu(false);
        setQuery('');
        setActive(0);
        updateUrl(selected, id);
        try {
            if (id === null)
                localStorage.removeItem('khl-team-filter');
            else
                localStorage.setItem('khl-team-filter', String(id));
        }
        catch { }
    }
    useEffect(() => {
        if (initialTeamId !== null)
            return;
        try {
            const saved = Number(localStorage.getItem('khl-team-filter'));
            if (saved > 0 && initialStandings.teamsById[saved])
                setTeamId(saved);
        }
        catch { }
    }, [initialTeamId, initialStandings]);
    useEffect(() => {
        const restore = () => { const url = new URL(window.location.href); const day = url.searchParams.get('date'); if (validDay(day)) {
            setSelected(day);
            setOpenedDay(day);
            setStart(day);
        } const id = Number(url.searchParams.get('team')); setTeamId(id > 0 ? id : null); };
        window.addEventListener('popstate', restore);
        return () => window.removeEventListener('popstate', restore);
    }, []);
    useEffect(() => {
        const close = (event: PointerEvent) => { if (!dropdown.current?.contains(event.target as Node))
            setMenu(false); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const results = await Promise.all(months.split(',').map(async (month) => {
                    const response = await fetch('/api/games?scope=all&month=' + month, { signal: controller.signal });
                    if (!response.ok)
                        throw new Error('Не удалось обновить расписание');
                    return await response.json() as GamesResponse;
                }));
                if (cancelled)
                    return;
                setCache(previous => ({ ...previous, ...Object.fromEntries(results.map(result => [result.month, result.games])) }));
                setError('');
                timer = setTimeout(load, results.some(result => result.games.some(game => game.status === 'LIVE')) ? 15000 : 180000);
            }
            catch (e) {
                if (cancelled)
                    return;
                setError(e instanceof Error ? e.message : 'Ошибка загрузки');
                timer = setTimeout(load, 30000);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
    }, [months, retry]);
    useEffect(() => {
        const controller = new AbortController();
        const load = async () => { try {
            const response = await fetch('/api/standings', { signal: controller.signal });
            if (response.ok) {
                const data: StandingsData = await response.json();
                setStandings(data.teamsById);
            }
        }
        catch { } };
        const timer = setInterval(load, 300000);
        return () => { clearInterval(timer); controller.abort(); };
    }, []);
    useEffect(() => {
        if (pendingScroll.current) {
            const element = document.getElementById('day-' + pendingScroll.current);
            if (element) {
                element.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
                pendingScroll.current = null;
            }
        }
    }, [selected, start, cache]);
    useEffect(() => {
        const selectedButton = document.getElementById('date-' + selected);
        selectedButton?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }, [selected]);
    useEffect(() => {
        const track = () => {
            if (Date.now() < scrollGuard.current)
                return;
            const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-schedule-day]'));
            const section = sections.filter(item => item.getBoundingClientRect().top <= 170).at(-1);
            if (section?.dataset.scheduleDay)
                setSelected(section.dataset.scheduleDay);
        };
        window.addEventListener('scroll', track, { passive: true });
        return () => window.removeEventListener('scroll', track);
    }, [start, teamId, live]);
    return <><a className="skip-link" href="#schedule">К расписанию</a><SiteHeader /><main id="schedule" className="flow-main">
    <header className="flow-title"><div><span>КХЛ · Регулярный чемпионат</span><h1>Расписание и результаты</h1><p>Время московское · Обновляется автоматически</p></div><div className="flow-scope" role="group" aria-label="Статус матчей"><button aria-pressed={!live} onClick={() => setLive(false)}>Все матчи</button><button aria-pressed={live} onClick={() => setLive(true)}><i className="live-dot"/>LIVE</button></div></header>
    <div className="flow-filter-row"><div className="team-combobox" ref={dropdown} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setMenu(false); }}><label className="sr-only" htmlFor="team-query">Фильтр по команде</label><input ref={input} id="team-query" role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={menu} aria-controls="team-options" aria-activedescendant={menu && options[active] ? 'team-option-' + active : undefined} placeholder="Все команды" value={menu ? query : currentTeam?.name ?? ''} onFocus={() => { setMenu(true); setQuery(''); setActive(0); }} onClick={() => setMenu(true)} onChange={event => { setQuery(event.target.value); setMenu(true); setActive(0); }} onKeyDown={event => { if (event.key === 'Escape') {
        setMenu(false);
        input.current?.blur();
    }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setMenu(true);
        setActive(value => Math.max(0, Math.min(options.length - 1, value + (event.key === 'ArrowDown' ? 1 : -1))));
    }
    else if (event.key === 'Enter' && menu && options[active]) {
        event.preventDefault();
        chooseTeam(options[active].id);
    } }}/><span aria-hidden="true">⌄</span>
      {menu && <div id="team-options" role="listbox" aria-label="Команды">{options.map((team, index) => <div id={'team-option-' + index} key={team.id ?? 'all'} role="option" aria-selected={teamId === team.id} className={index === active ? 'is-active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => chooseTeam(team.id)}>{team.id !== null && <TeamLogo team={{ ...team, id: team.id }} size={24} ring={false}/>}<span>{team.name}</span>{teamId === team.id && <span aria-hidden="true">✓</span>}</div>)}{!options.length && <p role="status">Команда не найдена</p>}</div>}
    </div>{currentTeam && <><button onClick={() => chooseTeam(null)}>Сбросить</button><Link className="flow-team-about" href={'/team/' + currentTeam.id}>О команде ›</Link></>}</div>
    <nav className="material-date-strip flow-date-strip" aria-label="Даты матчей"><button className="strip-arrow" aria-label="Предыдущая неделя" onClick={() => { const day = shiftDay(start, -7); setStart(day); chooseDay(day); }}>‹</button><div className="date-strip-scroll">{days.map(day => <button type="button" id={'date-' + day} key={day} className={'strip-day' + (selected === day ? ' strip-selected' : '') + (today === day ? ' strip-today' : '')} aria-pressed={selected === day} aria-label={label(day, { day: 'numeric', month: 'long', weekday: 'long' })} onClick={() => chooseDay(day)}><span>{today === day ? 'Сегодня' : label(day, { weekday: 'short' })}</span><b>{label(day, { day: 'numeric', month: 'short' })}</b><i className={byDay.has(day) ? 'has-matches' : ''}/></button>)}</div><button className="strip-arrow" aria-label="Следующая неделя" onClick={() => { const day = shiftDay(start, 7); setStart(day); chooseDay(day); }}>›</button><button className="strip-reset" onClick={() => { setStart(today); chooseDay(today); }}>Сегодня</button></nav>
    {error && <div className="schedule-error" role="alert"><p>{error}. Сохранённые матчи остаются доступны.</p><button onClick={() => setRetry(value => value + 1)}>Повторить</button></div>}
    <p className="schedule-loading" role="status">{loading ? 'Обновляем расписание…' : ''}</p>
    <div className="flow-days">{visibleDays.map(day => <section key={day} id={'day-' + day} className="flow-day" data-schedule-day={day}><header className="study-commandbar"><div className="flow-day-heading"><h2>{label(day, { day: 'numeric', month: 'long' })}</h2><span>{label(day, { weekday: 'long' })}</span></div><span className="flow-day-count">Матчей: {byDay.get(day)?.length ?? 0}</span></header>{byDay.get(day)?.map(game => <ScheduleGameRow key={game.id} game={game} standings={standings} showStats={false}/>) ?? <div className="study-empty"><h3>{live ? 'Нет матчей в эфире' : 'Матчей нет'}</h3><p>{teamId ? 'У выбранной команды нет матчей в этот день.' : 'Выберите другой день в календаре.'}</p></div>}</section>)}</div>
    <div className="flow-more"><button onClick={() => { const day = shiftDay(start, 14); setStart(day); chooseDay(day); }}>Следующие две недели ↓</button><span>{label(start, { day: 'numeric', month: 'long' })} — {label(days.at(-1)!, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
    <footer className="flow-footer"><span>Время начала матчей — московское.</span><Link href="/standings">Турнирная таблица ›</Link></footer>
  </main></>;
}
