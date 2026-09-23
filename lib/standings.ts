import { prisma } from "./db";
import type { TeamStats } from "./types";

/**
 * ВАЖНО про "место в таблице": здесь считается ПРОСТОЕ общее место по очкам
 * среди вообще всех команд, без деления на конференции/дивизионы, как это
 * делает официальная турнирная таблица КХЛ. Дивизионы/конференции в базе
 * сейчас не хранятся (мы их не тянули с khl.ru) — если понадобится точное
 * официальное место, нужно либо парсить отдельный эндпоинт таблицы на
 * khl.ru, либо добавить группы команд в схему и учитывать их здесь.
 *
 * Система очков — 2 за победу (в т.ч. в ОТ/буллитах), 1 за поражение в
 * ОТ/буллитах, 0 за поражение в основное время — совпадает с реальной
 * схемой КХЛ.
 */
export async function computeStandings(): Promise<Record<number, TeamStats>> {
  const games = await prisma.game.findMany({
    where: { status: "FINISHED" },
    select: { teamAId: true, teamBId: true, homeScore: true, visitorScore: true, overtime: true },
  });

  type Raw = { wins: number; losses: number; otLosses: number; points: number; gamesPlayed: number };
  const raw: Record<number, Raw> = {};

  function ensure(id: number): Raw {
    if (!raw[id]) raw[id] = { wins: 0, losses: 0, otLosses: 0, points: 0, gamesPlayed: 0 };
    return raw[id];
  }

  for (const g of games) {
    const home = g.homeScore ?? 0;
    const away = g.visitorScore ?? 0;
    if (home === away) continue; // на всякий случай, в хоккее ничьих не бывает

    const wasOt = Boolean(g.overtime);
    const a = ensure(g.teamAId);
    const b = ensure(g.teamBId);
    a.gamesPlayed++;
    b.gamesPlayed++;

    if (home > away) {
      a.wins++;
      a.points += 2;
      if (wasOt) {
        b.otLosses++;
        b.points += 1;
      } else {
        b.losses++;
      }
    } else {
      b.wins++;
      b.points += 2;
      if (wasOt) {
        a.otLosses++;
        a.points += 1;
      } else {
        a.losses++;
      }
    }
  }

  const ranked = Object.entries(raw)
    .map(([id, s]) => ({ id: Number(id), ...s }))
    .sort((x, y) => y.points - x.points || y.wins - x.wins);

  const result: Record<number, TeamStats> = {};
  ranked.forEach((t, i) => {
    result[t.id] = {
      wins: t.wins,
      losses: t.losses,
      otLosses: t.otLosses,
      points: t.points,
      gamesPlayed: t.gamesPlayed,
      rank: i + 1,
    };
  });
  return result;
}
