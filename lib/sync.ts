import { prisma } from "./db";
import { fetchKhlCalendar, flattenGames, mapGameStatus } from "./khl-client";

export async function syncKhlData() {
  const calendar = await fetchKhlCalendar();
  const { TEAMS, ARENAS } = calendar.data;

  // Команды и арены — сначала, чтобы игры могли на них ссылаться (foreign keys)
  await prisma.$transaction([
    ...Object.entries(TEAMS)
      .filter(([id]) => id !== "0") // "0" в TEAMS — заглушка на "нет команды"
      .map(([id, team]) =>
        prisma.team.upsert({
          where: { id: Number(id) },
          create: { id: Number(id), name: team.NAME, logoUrl: team.LOGO },
          update: { name: team.NAME, logoUrl: team.LOGO },
        })
      ),
    ...Object.entries(ARENAS)
      .filter(([id, city]) => id !== "0" && city !== "")
      .map(([id, city]) =>
        prisma.arena.upsert({
          where: { id: Number(id) },
          create: { id: Number(id), city },
          update: { city },
        })
      ),
  ]);

  const games = flattenGames(calendar.data.GAMES);

  let created = 0;
  let updated = 0;

  for (const game of games) {
    const existing = await prisma.game.findUnique({ where: { id: game.id } });

    await prisma.game.upsert({
      where: { id: game.id },
      create: {
        id: game.id,
        tnId: game.tnId,
        date: new Date(game.date),
        timeFormat: game.time_format,
        status: mapGameStatus(game),
        teamAId: game.teama,
        teamBId: game.teamb,
        arenaId: game.arenaid || null,
        homeScore: game.homeScore !== "" ? Number(game.homeScore) : null,
        visitorScore: game.visitorScore !== "" ? Number(game.visitorScore) : null,
        periodScores: game.scP ?? undefined,
        overtime: game.ots || null,
        winnerTeamId: game.win || null,
      },
      update: {
        status: mapGameStatus(game),
        homeScore: game.homeScore !== "" ? Number(game.homeScore) : null,
        visitorScore: game.visitorScore !== "" ? Number(game.visitorScore) : null,
        periodScores: game.scP ?? undefined,
        overtime: game.ots || null,
        winnerTeamId: game.win || null,
      },
    });

    if (existing) updated++;
    else created++;
  }

  return { teams: Object.keys(TEAMS).length, games: games.length, created, updated };
}
