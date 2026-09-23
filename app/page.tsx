"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { GameRow } from "@/components/GameRow";
import type { Game } from "@/lib/types";
import { dayKey, formatDayHeading } from "@/lib/format";
import { colors } from "@/lib/theme";

type GamesResponse = {
  games: Game[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type Tab = "SCHEDULED" | "LIVE" | "FINISHED";

const TABS: { key: Tab; label: string }[] = [
  { key: "SCHEDULED", label: "Предстоящие" },
  { key: "LIVE", label: "Идут сейчас" },
  { key: "FINISHED", label: "Прошедшие" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("SCHEDULED");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<GamesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    setData(null);
    setError(null);
    const params = new URLSearchParams({ status: tab, page: String(page), pageSize: "20" });
    fetch(`/api/games?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить расписание");
        return res.json();
      })
      .then((json: GamesResponse) => setData(json))
      .catch((e) => setError(e.message));
  }, [tab, page]);

  const games = data?.games ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const g of games) {
      const key = dayKey(g.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    return Array.from(map.entries());
  }, [games]);

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <span style={styles.wordmark}>Расписание КХЛ</span>
        <nav style={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ ...styles.tabButton, ...(tab === t.key ? styles.tabButtonActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>Не удалось загрузить</p>
          <p style={styles.emptyBody}>{error}. Обновите страницу через минуту.</p>
        </div>
      )}

      {!error && data === null && (
        <div style={styles.emptyState}>
          <p style={styles.emptyBody}>Загружаем…</p>
        </div>
      )}

      {!error && data !== null && data.games.length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>Матчей не найдено</p>
          <p style={styles.emptyBody}>Для этой вкладки пока нет данных.</p>
        </div>
      )}

      {grouped.length > 0 && (
        <section style={styles.list}>
          {grouped.map(([date, dayGames]) => (
            <div key={date}>
              <div style={styles.dayHeading}>{formatDayHeading(date)}</div>
              {dayGames.map((g) => (
                <GameRow key={g.id} game={g} />
              ))}
            </div>
          ))}
        </section>
      )}

      {data && data.totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            style={styles.pageButton}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Назад
          </button>
          <span style={styles.pageLabel}>
            Стр. {data.page} из {data.totalPages}
          </span>
          <button
            style={styles.pageButton}
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
          >
            Вперёд
          </button>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: colors.bg,
    color: colors.text,
    fontFamily: "var(--font-body)",
    fontSize: "1.05rem",
    paddingBottom: "4rem",
  },
  topbar: {
    padding: "1.5rem clamp(1.25rem, 5vw, 3rem) 1rem",
    borderBottom: `1px solid ${colors.border}`,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
  },
  wordmark: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "1.1rem",
    letterSpacing: "0.04em",
    color: colors.muted,
  },
  tabs: {
    display: "flex",
    gap: "0.4rem",
  },
  tabButton: {
    fontFamily: "var(--font-display)",
    fontSize: "0.95rem",
    fontWeight: 500,
    padding: "0.5rem 1rem",
    borderRadius: "999px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    background: "transparent",
    color: colors.muted,
    cursor: "pointer",
  },
  tabButtonActive: {
    borderColor: colors.accent,
    color: colors.bg,
    background: colors.accent,
  },
  emptyState: {
    padding: "3rem clamp(1.25rem, 5vw, 3rem)",
  },
  emptyTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "1.35rem",
    fontWeight: 600,
    margin: "0 0 0.4rem",
  },
  emptyBody: {
    color: colors.muted,
    margin: 0,
    fontSize: "1.05rem",
  },
  list: {
    padding: "1rem clamp(1.25rem, 5vw, 3rem) 0",
  },
  dayHeading: {
    fontFamily: "var(--font-display)",
    fontSize: "0.9rem",
    fontWeight: 600,
    letterSpacing: "0.03em",
    color: colors.muted,
    padding: "1.75rem 0 0.6rem",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    padding: "2rem clamp(1.25rem, 5vw, 3rem) 0",
  },
  pageButton: {
    fontFamily: "var(--font-display)",
    fontSize: "0.9rem",
    padding: "0.55rem 1.2rem",
    borderRadius: "6px",
    border: `1px solid ${colors.border}`,
    background: "transparent",
    color: colors.text,
    cursor: "pointer",
  },
  pageLabel: {
    color: colors.muted,
    fontSize: "0.9rem",
  },
};
