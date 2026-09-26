"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { GameRow } from "@/components/GameRow";
import type { Game, StandingsData } from "@/lib/types";
import { dayKey, formatDayHeading } from "@/lib/format";
import { formatRange, parseTimeMinutes } from "@/lib/schedule";
import { colors } from "@/lib/theme";

type GamesResponse = { games: Game[]; scope: "upcoming" | "past"; page: number; rangeStart: string; rangeEnd: string };
type Tab = "upcoming" | "past";

const TABS: { key: Tab; label: string }[] = [{ key: "upcoming", label: "Предстоящие" }, { key: "past", label: "Прошедшие" }];

function cacheKey(tab: Tab, page: number) {
  return `${tab}:${page}`;
}

async function fetchGames(tab: Tab, page: number): Promise<GamesResponse> {
  const params = new URLSearchParams({ scope: tab, page: String(page) });
  const res = await fetch(`/api/games?${params.toString()}`);
  if (!res.ok) throw new Error("Не удалось загрузить расписание");
  return res.json() as Promise<GamesResponse>;
}

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

  // Клиентский кэш уже загруженных вкладок/страниц — переключение между
  // ними, если данные уже есть, происходит мгновенно (без пустого экрана),
  // а свежесть всё равно подтверждается фоновым fetch (stale-while-revalidate).
  const cacheRef = useRef<Map<string, GamesResponse>>(new Map([[cacheKey(initialData.scope, initialData.page), initialData]]));

  const [view, setView] = useState<{ tab: Tab; page: number }>({ tab, page });

  function setUrl(nextTab: Tab, nextPage: number) {
    setView({ tab: nextTab, page: nextPage }); // мгновенно
    const params = new URLSearchParams({ tab: nextTab, page: String(nextPage) });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // синхронизация при назад/вперёд браузера
  useEffect(() => { setView({ tab, page }); }, [tab, page]);

  useEffect(() => {
    let cancelled = false;

    const load = () =>
      fetchGames(tab, page)
        .then((json) => {
          if (cancelled) return;
          cacheRef.current.set(cacheKey(tab, page), json);
          setError(null);
          setData(json);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });

    load();
    const timer = window.setInterval(load, 180_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [tab, page]);

  // Фоновый prefetch соседней вкладки (той же страницы) — чтобы первое
  // переключение на неё тоже было мгновенным, а не только повторные.
  useEffect(() => {
    const otherTab: Tab = tab === "upcoming" ? "past" : "upcoming";
    const key = cacheKey(otherTab, 1);
    if (cacheRef.current.has(key)) return;

    let cancelled = false;
    fetchGames(otherTab, 1)
      .then((json) => { if (!cancelled) cacheRef.current.set(key, json); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => {
    const loadStandings = () => fetch("/api/standings")
      .then((res) => res.json() as Promise<StandingsData>)
      .then((json) => setStandings(json.teamsById))
      .catch(() => { });
    loadStandings();
    const timer = window.setInterval(loadStandings, 300_000);
    return () => window.clearInterval(timer);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const game of data.games) {
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
  }, [data.games]);

  const rangeLabel = formatRange(new Date(data.rangeStart), new Date(data.rangeEnd));

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <span style={styles.wordmark}>Расписание КХЛ</span>
        <nav style={styles.tabs}>
          <Link href="/standings" style={styles.standingsLink}>Таблица</Link>
          {TABS.map((item) => <button key={item.key} onClick={() => setUrl(item.key, 1)} style={{ ...styles.tabButton, ...(tab === item.key ? styles.tabButtonActive : {}) }}>{item.label}</button>)}
        </nav>
      </header>
      {error && <div style={styles.emptyState}><p style={styles.emptyTitle}>Не удалось загрузить</p><p style={styles.emptyBody}>{error}. Обновите страницу через минуту.</p></div>}
      {!error && data.games.length === 0 && <div style={styles.emptyState}><p style={styles.emptyTitle}>Матчей не найдено</p><p style={styles.emptyBody}>За этот период ({rangeLabel}) матчей нет — попробуйте соседний период.</p></div>}
      {grouped.length > 0 && <section style={styles.list}>{grouped.map(([date, dayGames]) => <div key={date}><div style={styles.dayHeading}>{formatDayHeading(date)}</div>{dayGames.map((game) => <GameRow key={game.id} game={game} standings={standings} compactStats={tab === "upcoming"} showStats={tab === "upcoming"} />)}</div>)}</section>}
      <div style={styles.pagination}>
        <button style={styles.pageButton} disabled={page <= 1} onClick={() => setUrl(tab, page - 1)}>Назад</button>
        <span style={styles.pageLabel}>{rangeLabel}</span>
        <button style={styles.pageButton} onClick={() => setUrl(tab, page + 1)}>Вперёд</button>
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
  emptyState: { padding: "3rem clamp(1.25rem, 5vw, 3rem)" },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 600, margin: "0 0 0.4rem" },
  emptyBody: { color: colors.muted, margin: 0, fontSize: "1.05rem" },
  list: { padding: "1rem clamp(1.25rem, 5vw, 3rem) 0" },
  dayHeading: { fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 600, letterSpacing: "0.03em", color: colors.muted, padding: "1.75rem 0 0.6rem" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "2rem clamp(1.25rem, 5vw, 3rem) 0" },
  pageButton: { fontFamily: "var(--font-display)", fontSize: "0.9rem", padding: "0.55rem 1.2rem", borderRadius: "6px", border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, cursor: "pointer" },
  pageLabel: { color: colors.muted, fontSize: "0.9rem", fontFamily: "var(--font-display)" },
};
