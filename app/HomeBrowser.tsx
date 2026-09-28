"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { GameRow } from "@/components/GameRow";
import type { Game, StandingsData, StandingsTeam } from "@/lib/types";
import { dayKey, formatDayHeading } from "@/lib/format";
import { currentMonthKey, formatMonthLabel, parseTimeMinutes, shiftMonthKey } from "@/lib/schedule";
import { colors } from "@/lib/theme";
import { TeamLogo } from "@/components/TeamLogo";

const TEAM_STORAGE_KEY = "khl-stats:team";

type GamesResponse = { games: Game[]; scope: "upcoming" | "past"; month: string };
type NearestResponse = { day: "today" | "tomorrow"; date: string; games: Game[] };
type Tab = "upcoming" | "past";

const TABS: { key: Tab; label: string }[] = [
  { key: "upcoming", label: "Матчи" },
  { key: "past", label: "Результаты" },
];

const LIVE_POLL_MS = 15_000;
const IDLE_POLL_MS = 180_000;
const NEAREST_IDLE_POLL_MS = 120_000;

function hasLiveGame(games: Game[]): boolean {
  return games.some((g) => g.status === "LIVE");
}


export default function HomeBrowser({
  initialNearest,
  initialData,
  initialStandings,
}: {
  initialNearest: NearestResponse;
  initialData: GamesResponse;
  initialStandings: StandingsData;
}) {
  return (
    <Suspense fallback={null}>
      <HomeContent initialNearest={initialNearest} initialData={initialData} initialStandings={initialStandings} />
    </Suspense>
  );
}

function GameRowSkeleton() {
  return (
    <div style={styles.skeletonRow}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.7rem" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem" }}>
            <div style={{ ...styles.skeletonBar, width: "7rem", height: "1rem" }} />
            <div style={{ ...styles.skeletonBar, width: "4.5rem", height: "0.65rem" }} />
          </div>
          <div style={styles.skeletonLogo} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem", minWidth: "4.75rem" }}>
          <div style={{ ...styles.skeletonBar, width: "2.5rem", height: "1.1rem" }} />
          <div style={{ ...styles.skeletonBar, width: "1.8rem", height: "0.55rem" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "0.7rem" }}>
          <div style={styles.skeletonLogo} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.35rem" }}>
            <div style={{ ...styles.skeletonBar, width: "7rem", height: "1rem" }} />
            <div style={{ ...styles.skeletonBar, width: "4.5rem", height: "0.65rem" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GamesSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <GameRowSkeleton key={i} />
      ))}
    </div>
  );
}

function TeamFilter({
  teams,
  selectedId,
  onChange,
}: {
  teams: StandingsTeam[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = teams.find((t) => t.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? teams.filter((t) => t.name.toLowerCase().includes(q)) : teams;
  }, [teams, query]);

  function close() {
    setOpen(false);
    setQuery("");
    setHighlight(0);
  }

  function pick(id: number | null) {
    onChange(id);
    close();
    inputRef.current?.blur();
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const team = filtered[highlight];
      if (team) pick(team.id);
    } else if (e.key === "Escape") {
      close();
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={wrapRef} style={styles.teamFilter}>
      <div style={styles.teamFilterBox} onClick={() => inputRef.current?.focus()}>
        {selected && (
          <TeamLogo team={{ id: selected.id, name: selected.name, logoUrl: selected.logoUrl }} size={22} ring={false} />
        )}
        <input
          ref={inputRef}
          value={open ? query : selected?.name ?? ""}
          placeholder="Фильтр по команде"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          style={styles.teamFilterInput}
          aria-label="Фильтр по команде"
        />
        {selected && !open && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              pick(null);
            }}
            style={styles.teamFilterClear}
            aria-label="Сбросить фильтр"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div style={styles.teamDropdown} role="listbox">
          {query === "" && (
            <div
              role="option"
              aria-selected={selectedId === null}
              onClick={() => pick(null)}
              style={{ ...styles.teamOption, color: colors.muted }}
            >
              Все команды
            </div>
          )}
          {filtered.length === 0 && <div style={{ ...styles.teamOption, color: colors.muted, cursor: "default" }}>Ничего не найдено</div>}
          {filtered.map((team, index) => (
            <div
              key={team.id}
              role="option"
              aria-selected={team.id === selectedId}
              onClick={() => pick(team.id)}
              onMouseEnter={() => setHighlight(index)}
              style={{ ...styles.teamOption, background: index === highlight ? colors.borderSoft : "transparent" }}
            >
              <TeamLogo team={{ id: team.id, name: team.name, logoUrl: team.logoUrl }} size={24} ring={false} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HomeContent({
  initialNearest,
  initialData,
  initialStandings,
}: {
  initialNearest: NearestResponse;
  initialData: GamesResponse;
  initialStandings: StandingsData;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab: Tab = searchParams.get("tab") === "past" ? "past" : "upcoming";
  const monthParam = searchParams.get("month");
  const month = monthParam && /^\d{4}$/.test(monthParam) ? monthParam : currentMonthKey();

  const [nearest, setNearest] = useState<NearestResponse>(initialNearest);
  const [data, setData] = useState<GamesResponse>(initialData);
  const [standings, setStandings] = useState(initialStandings.teamsById);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const teamParam = searchParams.get("team");
  const teamId = teamParam && /^\d+$/.test(teamParam) ? Number(teamParam) : null;

  const showNearest = tab === "upcoming" && month === currentMonthKey() && teamId === null;

  function setUrl(nextTab: Tab, nextMonth: string, nextTeamId: number | null = teamId) {
    const params = new URLSearchParams({ tab: nextTab, month: nextMonth });
    if (teamId !== null) params.set("team", String(teamId));
    if (nextTeamId !== null) params.set("team", String(nextTeamId));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function switchTab(nextTab: Tab) {
    setUrl(nextTab, currentMonthKey());
  }

  function switchMonth(delta: number) {
    setUrl(tab, shiftMonthKey(month, delta));
  }

  function switchTeam(id: number | null) {
    try {
      if (id === null) window.localStorage.removeItem(TEAM_STORAGE_KEY);
      else window.localStorage.setItem(TEAM_STORAGE_KEY, String(id));
    } catch { }
    setUrl(tab, month, id);
  }

  // Восстановить сохранённую команду при заходе без ?team=
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (teamId !== null) return;
    try {
      const stored = window.localStorage.getItem(TEAM_STORAGE_KEY);
      const id = stored && /^\d+$/.test(stored) ? Number(stored) : null;
      if (id !== null && standings[id]) {
        const params = new URLSearchParams({ tab, month, team: String(id) });
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab, month, teamId]);

  useEffect(() => {
    const params = new URLSearchParams({ scope: tab, month });
    let cancelled = false;
    let timer: number;
    setIsLoading(true);

    const load = () =>
      fetch(`/api/games?${params.toString()}`)
        .then((res) => { if (!res.ok) throw new Error("Не удалось загрузить расписание"); return res.json() as Promise<GamesResponse>; })
        .then((json) => {
          if (cancelled) return;
          setError(null);
          setData(json);
          setIsLoading(false);
          scheduleNext(hasLiveGame(json.games));
        })
        .catch((e: Error) => {
          if (cancelled) return;
          setError(e.message);
          setIsLoading(false);
          scheduleNext(false);
        });

    function scheduleNext(live: boolean) {
      if (cancelled) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(load, live ? LIVE_POLL_MS : IDLE_POLL_MS);
    }

    load();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [tab, month]);

  useEffect(() => {
    if (!showNearest) return;
    let cancelled = false;
    let timer: number;

    const load = () =>
      fetch("/api/games/nearest")
        .then((res) => res.json() as Promise<NearestResponse>)
        .then((json) => {
          if (cancelled) return;
          setNearest(json);
          scheduleNext(hasLiveGame(json.games));
        })
        .catch(() => { if (!cancelled) scheduleNext(false); });

    function scheduleNext(live: boolean) {
      if (cancelled) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(load, live ? LIVE_POLL_MS : NEAREST_IDLE_POLL_MS);
    }

    load();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [showNearest]);

  useEffect(() => {
    const loadStandings = () =>
      fetch("/api/standings")
        .then((res) => res.json() as Promise<StandingsData>)
        .then((json) => setStandings(json.teamsById))
        .catch(() => { });
    loadStandings();
    const timer = window.setInterval(loadStandings, 300_000);
    return () => window.clearInterval(timer);
  }, []);

  const nearestDayKey = useMemo(() => dayKey(nearest.date), [nearest.date]);

  const grouped = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const game of data.games) {
      const key = dayKey(game.date);
      if (showNearest && key === nearestDayKey) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(game);
    }
    return Array.from(map.entries()).map(([date, dayGames]) => [
      date,
      [...dayGames].sort((a, b) => parseTimeMinutes(a.timeFormat) - parseTimeMinutes(b.timeFormat)),
    ] as [string, Game[]]);
  }, [data.games, showNearest, nearestDayKey]);

  const teamOptions = useMemo(
    () => Object.values(standings).sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [standings]
  );

  const pagination = (compact?: boolean): ReactNode => (
    <div style={compact ? styles.paginationInline : styles.pagination}>
      <button style={styles.pageButton} onClick={() => switchMonth(-1)}>← Назад</button>
      <span style={styles.pageLabel}>{formatMonthLabel(month)}</span>
      <button style={styles.pageButton} onClick={() => switchMonth(1)}>Вперёд →</button>
    </div>
  );

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <style>{`
          @keyframes khl-skeleton-pulse {
            0%, 100% { opacity: 0.45; }
            50% { opacity: 0.85; }
          }
        `}</style>
        <Link href="/" style={styles.wordmark}>Расписание КХЛ</Link>
        <Link
          href="/standings"
          style={{ ...styles.standingsLink, ...(hoveredNav === "standings" ? styles.standingsLinkHover : {}) }}
          onMouseEnter={() => setHoveredNav("standings")}
          onMouseLeave={() => setHoveredNav(null)}
        >
          Таблица
        </Link>
      </header>

      {showNearest && (
        <section style={styles.nearestSection}>
          <span style={styles.nearestBadge}>
            {nearest.day === "today" ? "Сегодня" : "Завтра"} {formatDayHeading(nearest.date)}
          </span>
          {nearest.games.length === 0 && (
            <p style={styles.emptyBody}>На {nearest.day === "today" ? "сегодня" : "завтра"} матчей не запланировано.</p>
          )}
          {nearest.games.map((game) => (
            <GameRow key={game.id} game={game} standings={standings} compactStats showStats />
          ))}
        </section>
      )}

      <div style={styles.controlsRow}>
        <TeamFilter teams={teamOptions} selectedId={teamId} onChange={switchTeam} />
        {pagination(true)}
        <nav style={styles.tabs}>
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => switchTab(item.key)}
              onMouseEnter={() => setHoveredNav(item.key)}
              onMouseLeave={() => setHoveredNav(null)}
              style={{
                ...styles.tabButton,
                ...(tab === item.key ? styles.tabButtonActive : {}),
                ...(hoveredNav === item.key && tab !== item.key ? styles.tabButtonHover : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div aria-hidden />
      </div>
      {
        isLoading ? (
          <GamesSkeleton />
        ) : (
          <>
            {error && (
              <div style={styles.emptyState}>
                <p style={styles.emptyTitle}>Не удалось загрузить</p>
                <p style={styles.emptyBody}>{error}. Обновите страницу через минуту.</p>
              </div>
            )}
            {!error && data.games.length === 0 && (
              <div style={styles.emptyState}>
                <p style={styles.emptyTitle}>Матчей не найдено</p>
              </div>
            )}
            {grouped.length > 0 && (
              <section style={styles.list}>
                {grouped.map(([date, dayGames]) => (
                  <div key={date}>
                    <div style={styles.dayHeading}>{formatDayHeading(date)}</div>
                    {dayGames.map((game) => (
                      <GameRow key={game.id} game={game} standings={standings} compactStats={tab === "upcoming"} showStats={tab === "upcoming"} />
                    ))}
                  </div>
                ))}
              </section>
            )}
          </>
        )
      }

      {pagination()}
    </main >
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: "var(--font-body)", fontSize: "1.05rem", paddingBottom: "4rem" },
  topbar: { padding: "1.5rem clamp(1.25rem, 5vw, 3rem) 1rem", borderBottom: `1px solid ${colors.border}`, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" },
  wordmark: { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.04em", color: colors.muted },
  standingsLink: {
    color: colors.accent,
    fontFamily: "var(--font-display)",
    fontSize: "0.95rem",
    padding: "0.5rem 0.7rem",
    textDecoration: "none",
    transition: "opacity 0.18s ease",
  },
  standingsLinkHover: { opacity: 0.7 },

  nearestSection: {
    margin: "1.5rem clamp(1.25rem, 5vw, 3rem) 0",
    padding: "1.25rem 1.5rem 1.5rem",
    borderRadius: "16px",
    border: `1px solid ${colors.accent}`,
    background: `color-mix(in srgb, ${colors.accent} 8%, ${colors.bg})`,
    textAlign: "center",
  },
  nearestBadge: {
    display: "inline-block",
    fontFamily: "var(--font-display)",
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: colors.bg,
    background: colors.accent,
    borderRadius: "999px",
    padding: "0.25rem 0.65rem",
    marginBottom: "1rem",
  },
  nearestTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "1.1rem",
    marginBottom: "0.75rem",
    color: colors.text,
  },
  nearestRow: {
    borderBottom: `1px solid ${colors.border}`
  },
  controlsRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: "1rem",
    padding: "1.5rem clamp(1.25rem, 5vw, 3rem) 0",
  },
  tabs: { display: "flex", gap: "0.4rem", alignItems: "center", justifySelf: "end" },
  tabButton: {
    fontFamily: "var(--font-display)",
    fontSize: "0.9rem",
    fontWeight: 500,
    lineHeight: 1,
    padding: "0.6rem 1.1rem",
    borderRadius: "999px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    background: "transparent",
    color: colors.muted,
    cursor: "pointer",
    transition: "border-color 0.18s ease, color 0.18s ease, background 0.18s ease",
  },
  tabButtonHover: { borderColor: colors.accent, color: colors.text },
  tabButtonActive: { borderColor: colors.accent, color: colors.bg, background: colors.accent },

  emptyState: { padding: "3rem clamp(1.25rem, 5vw, 3rem)" },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 600, margin: "0 0 0.4rem", textAlign: "center" },
  emptyBody: { color: colors.muted, margin: 0, fontSize: "1.05rem", textAlign: "center" },
  list: { padding: "1rem clamp(1.25rem, 5vw, 3rem) 0" },
  dayHeading: { fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 600, letterSpacing: "0.03em", color: colors.muted, padding: "1.75rem 0 0.6rem", textAlign: "center" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "2rem clamp(1.25rem, 5vw, 3rem) 0" },
  paginationInline: { display: "flex", alignItems: "center", gap: "0.75rem", justifySelf: "center", gridColumn: 2 },
  pageButton: {
    fontFamily: "var(--font-display)",
    fontSize: "0.9rem",
    fontWeight: 500,
    lineHeight: 1,
    padding: "0.6rem 1.1rem",
    borderRadius: "6px",
    border: `1px solid ${colors.border}`,
    background: "transparent",
    color: colors.text,
    cursor: "pointer",
    transition: "border-color 0.18s ease, color 0.18s ease",
  },
  pageLabel: { color: colors.muted, fontSize: "0.9rem", fontFamily: "var(--font-display)", lineHeight: 1, whiteSpace: "nowrap" },
  skeletonRow: { padding: "0.9rem clamp(1.25rem, 5vw, 3rem)", borderBottom: `1px solid ${colors.borderSoft}` },
  skeletonLogo: { width: "56px", height: "56px", borderRadius: "50%", background: colors.borderSoft, flexShrink: 0, animation: "khl-skeleton-pulse 1.2s ease-in-out infinite" },
  skeletonBar: { borderRadius: "4px", background: colors.borderSoft, animation: "khl-skeleton-pulse 1.2s ease-in-out infinite" },
  teamSelect: {
    justifySelf: "start",
    maxWidth: "100%",
    fontFamily: "var(--font-display)",
    fontSize: "0.9rem",
    fontWeight: 500,
    lineHeight: 1,
    padding: "0.6rem 1.1rem",
    borderRadius: "6px",
    border: `1px solid ${colors.border}`,
    background: colors.bg,
    color: colors.text,
    cursor: "pointer",
  },
  teamFilter: { position: "relative", justifySelf: "start", width: "100%", maxWidth: "18rem" },
  teamFilterBox: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    height: "2.4rem",
    boxSizing: "border-box",
    padding: "0 0.75rem",
    borderRadius: "6px",
    border: `1px solid ${colors.border}`,
    background: colors.bg,
    cursor: "text",
  },
  teamFilterInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    color: colors.text,
    fontFamily: "var(--font-display)",
    fontSize: "0.9rem",
  },
  teamFilterClear: {
    border: "none",
    background: "transparent",
    color: colors.muted,
    fontSize: "1.1rem",
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
  },
  teamDropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    width: "100%",
    minWidth: "16rem",
    maxHeight: "20rem",
    overflowY: "auto",
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
    zIndex: 20,
  },
  teamOption: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    padding: "0.45rem 0.75rem",
    fontFamily: "var(--font-display)",
    fontSize: "0.9rem",
    cursor: "pointer",
  },
};