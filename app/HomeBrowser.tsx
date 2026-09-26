"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { GameRow } from "@/components/GameRow";
import { TeamLogo } from "@/components/TeamLogo";
import type { Game, StandingsData } from "@/lib/types";
import { dayKey, formatDayHeading } from "@/lib/format";
import { formatRange, parseTimeMinutes } from "@/lib/schedule";
import { colors } from "@/lib/theme";

type GamesResponse = { games: Game[]; scope: "upcoming" | "past"; page: number; rangeStart: string; rangeEnd: string };
type Tab = "upcoming" | "past";
const TABS: { key: Tab; label: string }[] = [{ key: "upcoming", label: "Предстоящие" }, { key: "past", label: "Прошедшие" }];

const TEAM_FILTER_KEY = "khl-team-filter";

export default function HomeBrowser({ initialData, initialStandings }: { initialData: GamesResponse; initialStandings: StandingsData }) {
  return <Suspense fallback={null}><HomeContent initialData={initialData} initialStandings={initialStandings} /></Suspense>;
}

function HomeContent({ initialData, initialStandings }: { initialData: GamesResponse; initialStandings: StandingsData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "past" ? "past" : "upcoming";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  
  const [data, setData] = useState<GamesResponse>(initialData);
  const [standings, setStandings] = useState(initialStandings.teamsById);
  const [error, setError] = useState<string | null>(null);

  // Оптимистичное состояние вкладки/страницы: обновляется в момент клика,
  // не дожидаясь ответа сервера (фикс задержки скрытия статистики).
  const [view, setView] = useState<{ tab: Tab; page: number }>({ tab, page });

  // Фильтр по команде
  const [teamQuery, setTeamQuery] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  function setUrl(nextTab: Tab, nextPage: number) {
    setView({ tab: nextTab, page: nextPage });
    const params = new URLSearchParams({ tab: nextTab, page: String(nextPage) });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Смена таба/страницы: сервер отдаёт новые initialData — синхронизируем стейт
  useEffect(() => {
    setData(initialData);
    setError(null);
  }, [initialData]);

  // Навигация назад/вперёд браузера — держим оптимистичное состояние в синхроне
  useEffect(() => {
    setView({ tab, page });
  }, [tab, page]);

  // Чтение сохранённой команды: приоритет у URL, иначе localStorage
  useEffect(() => {
    const fromUrl = searchParams.get("team");
    if (fromUrl != null && Number.isFinite(Number(fromUrl))) {
      setSelectedTeamId(Number(fromUrl));
    } else {
      const saved = window.localStorage.getItem(TEAM_FILTER_KEY);
      const parsed = saved != null ? Number(saved) : null;
      if (parsed != null && Number.isFinite(parsed)) setSelectedTeamId(parsed);
    }
    setHydrated(true);
  }, [searchParams]);

  const teams = useMemo(
    () => Object.values(standings).sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [standings]
  );

  const selectedTeam = useMemo(
    () => (selectedTeamId != null ? teams.find((t) => t.id === selectedTeamId) : undefined),
    [teams, selectedTeamId]
  );

  function chooseTeam(teamId: number | null) {
    setSelectedTeamId(teamId);
    try {
      if (teamId == null) window.localStorage.removeItem(TEAM_FILTER_KEY);
      else window.localStorage.setItem(TEAM_FILTER_KEY, String(teamId));
    } catch {
      // приватный режим / localStorage недоступен — молча живём дальше
    }
    const params = new URLSearchParams(searchParams.toString());
    if (teamId == null) params.delete("team");
    else params.set("team", String(teamId));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Сохранённая команда не найдена в текущем составе — сбрасываем
  useEffect(() => {
    if (hydrated && selectedTeamId != null && teams.length > 0 && !selectedTeam) {
      chooseTeam(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, teams, selectedTeamId, selectedTeam]);

  useEffect(() => {
    const loadStandings = () => fetch("/api/standings")
      .then((res) => res.json() as Promise<StandingsData>)
      .then((json) => setStandings(json.teamsById))
      .catch(() => { });

    loadStandings();
    const timer = window.setInterval(loadStandings, 300_000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredGames = useMemo(() => {
    if (selectedTeamId == null) return data.games;
    return data.games.filter(
      (g) => g.teamA.id === selectedTeamId || g.teamB.id === selectedTeamId
    );
  }, [data.games, selectedTeamId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const game of filteredGames) {
      const key = dayKey(game.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(game);
    }

    return Array.from(map.entries()).map(([date, dayGames]) => [
      date,
      [...dayGames].sort((a, b) => {
        const aMinutes = parseTimeMinutes(a.timeFormat);
        const bMinutes = parseTimeMinutes(b.timeFormat);
        return aMinutes - bMinutes;
      }),
    ] as [string, Game[]]);
  }, [filteredGames]);
  const rangeLabel = formatRange(new Date(data.rangeStart), new Date(data.rangeEnd));

  const menuTeams = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    return q ? teams.filter((t) => t.name.toLowerCase().includes(q)) : teams;
  }, [teams, teamQuery]);

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <span style={styles.wordmark}>Расписание КХЛ</span>
        <nav style={styles.tabs}>
          <Link href="/standings" style={styles.standingsLink} className="khl-link">Таблица</Link>
          {TABS.map((item) => <button key={item.key} onClick={() => setUrl(item.key, 1)} className="khl-tab" style={{ ...styles.tabButton, ...(view.tab === item.key ? styles.tabButtonActive : {}) }}>{item.label}</button>)}
        </nav>
      </header>

      <div style={styles.filterRow}>
        <div style={styles.filterWrap}>
          <input
            value={selectedTeam ? selectedTeam.name : teamQuery}
            onChange={(e) => {
              setSelectedTeamId(null);
              setTeamQuery(e.target.value);
              setTeamMenuOpen(true);
            }}
            onFocus={() => setTeamMenuOpen(true)}
            onBlur={() => window.setTimeout(() => setTeamMenuOpen(false), 150)}
            placeholder="Фильтр по команде…"
            style={styles.filterInput}
          />
          {teamMenuOpen && (
            <div style={styles.filterMenu}>
              {menuTeams.map((team) => (
                <button
                  key={team.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    chooseTeam(team.id);
                    setTeamMenuOpen(false);
                    setTeamQuery("");
                  }}
                  style={{ ...styles.filterMenuItem, ...(team.id === selectedTeamId ? styles.filterMenuItemActive : {}) }}
                >
                  <TeamLogo team={team} size={22} />
                  <span>{team.name}</span>
                </button>
              ))}
              {menuTeams.length === 0 && <div style={styles.filterMenuEmpty}>Команда не найдена</div>}
            </div>
          )}
        </div>
        {selectedTeam != null && (
          <button onClick={() => { chooseTeam(null); setTeamQuery(""); }} style={styles.filterClear}>✕ сбросить</button>
        )}
        {selectedTeam != null && (
          <span style={styles.filterCount}>Матчей: {filteredGames.length}</span>
        )}
      </div>

      {error && <div style={styles.emptyState}><p style={styles.emptyTitle}>Не удалось загрузить</p><p style={styles.emptyBody}>{error}. Обновите страницу через минуту.</p></div>}
      {!error && filteredGames.length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>Матчей не найдено</p>
          <p style={styles.emptyBody}>
            {selectedTeam != null
              ? `У «${selectedTeam.name}» на этом периоде (${rangeLabel}) матчей нет — попробуйте другую страницу или сбросьте фильтр.`
              : `За этот период (${rangeLabel}) матчей нет — попробуйте соседний период.`}
          </p>
        </div>
      )}
      {grouped.length > 0 && <section style={styles.list}>{grouped.map(([date, dayGames]) => <div key={date}><div style={styles.dayHeading}>{formatDayHeading(date)}</div>{dayGames.map((game) => <GameRow key={game.id} game={game} standings={standings} compactStats={view.tab === "upcoming"} showStats={view.tab === "upcoming"} />)}</div>)}</section>}
      <div style={styles.pagination}>
        <button style={styles.pageButton} className="khl-btn" disabled={view.page <= 1} onClick={() => setUrl(view.tab, view.page - 1)}>Назад</button>
        <span style={styles.pageLabel}>{rangeLabel}</span>
        <button style={styles.pageButton} className="khl-btn" onClick={() => setUrl(view.tab, view.page + 1)}>Вперёд</button>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: "var(--font-body)", fontSize: "1.05rem", paddingBottom: "4rem" },
  topbar: { padding: "1.5rem clamp(1.25rem, 5vw, 3rem) 1rem", borderBottom: `1px solid ${colors.border}`, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" },
  wordmark: { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.04em", color: colors.muted },
  tabs: { display: "flex", gap: "0.4rem", alignItems: "center" },
  standingsLink: { color: colors.accent, fontFamily: "var(--font-display)", fontSize: "0.95rem", padding: "0.5rem 0.7rem", textDecoration: "none" },
  tabButton: { fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 500, padding: "0.5rem 1rem", borderRadius: "999px", borderWidth: "1px", borderStyle: "solid", borderColor: colors.border, background: "transparent", color: colors.muted, cursor: "pointer" },
  tabButtonActive: { borderColor: colors.accent, color: colors.bg, background: colors.accent },
  filterRow: { padding: "1rem clamp(1.25rem, 5vw, 3rem) 0", display: "flex", alignItems: "flex-start", gap: "0.6rem", flexWrap: "wrap", position: "relative", zIndex: 5 },
  filterWrap: { position: "relative", flex: "1 1 260px", maxWidth: "320px" },
  filterInput: { width: "100%", fontFamily: "var(--font-body)", fontSize: "0.95rem", padding: "0.55rem 0.9rem", borderRadius: "999px", borderWidth: "1px", borderStyle: "solid", borderColor: colors.border, background: "transparent", color: colors.text, outline: "none", boxSizing: "border-box" },
  filterMenu: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: "280px", overflowY: "auto", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 10 },
  filterMenuItem: { display: "flex", alignItems: "center", gap: "0.6rem", width: "100%", padding: "0.5rem 0.8rem", background: "transparent", border: "none", color: colors.text, cursor: "pointer", textAlign: "left", fontSize: "0.95rem" },
  filterMenuItemActive: { background: `${colors.accent}22` },
  filterMenuEmpty: { padding: "0.7rem 0.9rem", color: colors.muted, fontSize: "0.9rem" },
  filterClear: { fontFamily: "var(--font-display)", fontSize: "0.8rem", padding: "0.55rem 0.9rem", borderRadius: "999px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.muted, cursor: "pointer", height: "fit-content" },
  filterCount: { color: colors.muted, fontSize: "0.85rem", fontFamily: "var(--font-display)", height: "fit-content", padding: "0.6rem 0" },
  emptyState: { padding: "3rem clamp(1.25rem, 5vw, 3rem)" },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 600, margin: "0 0 0.4rem" },
  emptyBody: { color: colors.muted, margin: 0, fontSize: "1.05rem" },
  list: { padding: "1rem clamp(1.25rem, 5vw, 3rem) 0" },
  dayHeading: { fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 600, letterSpacing: "0.03em", color: colors.muted, padding: "1.75rem 0 0.6rem" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "2rem clamp(1.25rem, 5vw, 3rem) 0" },
  pageButton: { fontFamily: "var(--font-display)", fontSize: "0.9rem", padding: "0.55rem 1.2rem", borderRadius: "6px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, cursor: "pointer" },
  pageLabel: { color: colors.muted, fontSize: "0.9rem", fontFamily: "var(--font-display)" },
};