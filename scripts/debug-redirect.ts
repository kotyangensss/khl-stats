/**
 * Диагностика: смотрим на РЕДИРЕКТЫ khl.ru вручную, не давая fetch их
 * автоматически проглатывать. Нужно понять: обычный ли это редирект
 * (например http→https) или защита от ботов (тогда решение будет другим).
 *
 * Запуск: npx tsx scripts/debug-redirect.ts
 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function main() {
  let url = "https://www.khl.ru/";
  let cookies = "";

  for (let i = 0; i < 6; i++) {
    console.log(`\n[${i}] → ${url}`);
    const res = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(cookies ? { Cookie: cookies } : {}),
      },
    });

    console.log("    статус:", res.status);
    const setCookie = res.headers.getSetCookie?.() ?? [];
    if (setCookie.length) {
      console.log("    Set-Cookie:", setCookie.map((c) => c.split(";")[0]));
      cookies = [cookies, ...setCookie.map((c) => c.split(";")[0])].filter(Boolean).join("; ");
    }

    const location = res.headers.get("location");
    console.log("    Location:", location);

    // Если это не редирект — выводим кусок тела и останавливаемся
    if (res.status < 300 || res.status >= 400 || !location) {
      const text = await res.text();
      console.log("    Тело (первые 500 симв.):", text.slice(0, 500));
      break;
    }

    url = new URL(location, url).toString();
  }
}

main().catch((err) => {
  console.error("✗ Ошибка:", err.message, err.cause ?? "");
});
