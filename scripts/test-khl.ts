/**
 * Изолированный тест клиента khl.ru — запускать ДО того, как пытаться
 * синхронизировать всю базу. Если здесь всё ок — можно идти дальше,
 * если нет — чинить нужно только этот файл/khl-client.ts.
 *
 * Запуск: npx tsx scripts/test-khl.ts
 */
import { fetchKhlCalendar, flattenGames, mapGameStatus } from "../lib/khl-client";

async function main() {
  console.log("Проверяю доступ в интернет из этой среды…");
  try {
    const probe = await fetch("https://example.com");
    console.log(`✓ Общий доступ в сеть есть (example.com → ${probe.status})`);
  } catch (e: any) {
    console.error("✗ Даже example.com не отвечает — проблема с сетью в Codespaces, а не в khl.ru:", e.cause ?? e.message);
    process.exit(1);
  }

  console.log("Запрашиваю сессию и календарь у khl.ru…");

  const calendar = await fetchKhlCalendar();

  const teamCount = Object.keys(calendar.data.TEAMS).length;
  const games = flattenGames(calendar.data.GAMES);

  console.log(`✓ Успех. Команд: ${teamCount}, игр в ответе: ${games.length}`);

  const sample = games[0];
  if (sample) {
    const teamA = calendar.data.TEAMS[sample.teama]?.NAME ?? "?";
    const teamB = calendar.data.TEAMS[sample.teamb]?.NAME ?? "?";
    console.log("Пример игры:", {
      id: sample.id,
      date: sample.date,
      matchup: `${teamA} — ${teamB}`,
      status: mapGameStatus(sample),
      score: `${sample.homeScore}:${sample.visitorScore}`,
    });
  }
}

main().catch((err) => {
  console.error("✗ Ошибка:", err.message);
  if (err.cause) console.error("  Причина (cause):", err.cause);
  process.exit(1);
});
