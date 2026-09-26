import { DurableObject } from "cloudflare:workers";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export interface Env {
  LIVE_POLLER: DurableObjectNamespace<LivePoller>;
  HYPERDRIVE: Hyperdrive;
}

type Session = { cookie: string; sessid: string };

const BASE_URL = "https://www.khl.ru";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36";

const LIVE_DELAY_MS = 12_000;
const IDLE_DELAY_MS = 180_000;

type LiveGameEvent = {
  period: number;
  time: string;
  team: "home" | "away" | string;
  scorer: string;
  assists: string[];
  score: string;
};

type KhlGameHeader = {
  id: number;
  status?: string;
  period?: number;
  time?: string;
  arena?: string;
  score?: { home?: number | string; away?: number | string };
  goals?: LiveGameEvent[];
};

type RawKhlGameHeader = KhlGameHeader & {
  showstatus?: string;
  isOnline?: boolean;
  game?: {
    id: number;
    arena?: string;
    homeScore?: number;
    visitorScore?: number;
    scP?: string[];
    score?: string;
  };
  proto?: {
    goals?: Record<string, Array<{
      per?: number;
      pmg_time?: string;
      teamAB?: "A" | "B" | string;
      scoreA?: string;
      scoreB?: string;
      scorer?: { name?: string };
      assist_1?: { name?: string };
      assist_2?: { name?: string };
    }>>;
  };
  online?: { status?: string; homeScore?: number; visitorScore?: number };
};

type KhlGameHeaderResponse = RawKhlGameHeader | {
  status: string;
  data: RawKhlGameHeader | null;
  errors?: unknown[];
};

function normalizeGameHeader(raw: RawKhlGameHeader): KhlGameHeader {
  if (!raw.game) return raw;
  const goals = Object.values(raw.proto?.goals ?? {})
    .flat()
    .map((goal) => ({
      period: goal.per ?? 0,
      time: goal.pmg_time ?? "",
      team: goal.teamAB === "A" ? "home" : "away",
      scorer: goal.scorer?.name ?? "",
      assists: [goal.assist_1?.name, goal.assist_2?.name].filter(
        (name): name is string => Boolean(name)
      ),
      score: `${goal.scoreA ?? ""}:${goal.scoreB ?? ""}`,
    }));

  return {
    id: raw.game.id,
    status: raw.showstatus,
    period: raw.period,
    time: raw.time,
    arena: raw.game.arena,
    goals: goals.length > 0 ? goals : undefined,
    score: raw.game.homeScore != null || raw.game.visitorScore != null
      ? { home: raw.game.homeScore, away: raw.game.visitorScore }
      : { home: raw.online?.homeScore, away: raw.online?.visitorScore },
  };
}

/** Расчётное время начала матча в UTC, по дате+времени из нашей БД (МСК, +03:00). */
function gameStartMoscow(date: Date, timeFormat: string | null): Date | null {
  const datePart = date.toISOString().slice(0, 10);
  const timePart = timeFormat && /^\d{1,2}:\d{2}$/.test(timeFormat) ? timeFormat : "00:00";
  const parsed = new Date(`${datePart}T${timePart}:00+03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nextQuarterHourAlarm(from: Date): Date {
  const candidate = new Date(from);
  const currentQuarterMinute = Math.floor(from.getUTCMinutes() / 15) * 15;
  candidate.setUTCMinutes(currentQuarterMinute, 5, 0);

  if (candidate.getTime() <= from.getTime()) {
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 15);
  }

  return candidate;
}


export class LivePoller extends DurableObject<Env> {
  private session: Session | null = null;
  private sessionExpiresAt = 0;
  private readonly SESSION_TTL_MS = 8 * 60 * 1000;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  // ---- HTTP-вход: сюда бьёт Worker, чтобы "разбудить" поллер ----
  async fetch(_request: Request): Promise<Response> {
    const existingAlarm = await this.ctx.storage.getAlarm();
    if (existingAlarm === null) {
      // Ещё не запущен — ставим первый alarm прямо сейчас.
      await this.ctx.storage.setAlarm(Date.now());
    }
    return new Response(JSON.stringify({ ok: true, alreadyRunning: existingAlarm !== null }), {
      headers: { "content-type": "application/json" },
    });
  }

  // ---- Основной самоподдерживающийся цикл ----
  async alarm(): Promise<void> {
    console.log(`[${new Date().toISOString()}] alarm fired`);

    let hasLive = false;
    try {
      hasLive = await this.checkAndSync();
    } catch (error) {
      console.error("LivePoller: checkAndSync failed:", error);
      this.session = null;
      this.sessionExpiresAt = 0;
    }

    const now = new Date();
    const nextAlarmAt = hasLive
      ? new Date(now.getTime() + LIVE_DELAY_MS)
      : nextQuarterHourAlarm(now);

    console.log(
      `[${now.toISOString()}] next alarm at ${nextAlarmAt.toISOString()}, hasLive=${hasLive}`
    );
    await this.ctx.storage.setAlarm(nextAlarmAt.getTime());
  }

  // ---- Сессия khl.ru (кэш в поле класса — безопасно, т.к. DO гарантированно один экземпляр) ----
  private async getSessionOnce(): Promise<Session> {
    let url = `${BASE_URL}/`;
    const cookieJar: string[] = [];
    let html = "";
    let lastStatus = 0;

    for (let hop = 0; hop < 5; hop++) {
      const response = await fetch(url, {
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ru-RU,ru;q=0.9",
          ...(cookieJar.length ? { Cookie: cookieJar.join("; ") } : {}),
        },
      });

      lastStatus = response.status;
      cookieJar.push(
        ...(response.headers.getSetCookie?.() ?? []).map((value) => value.split(";")[0])
      );

      const location = response.headers.get("location");
      if (!(response.status >= 300 && response.status < 400 && location)) {
        if (!response.ok) {
          throw new Error(`Не удалось загрузить главную страницу khl.ru: ${response.status}`);
        }
        html = await response.text();
        break;
      }
      url = new URL(location, url).toString();
    }

    const match = html.match(/sessid["'\s:=]+([a-f0-9]{32})/i);
    if (!match) {
      throw new Error(`Не удалось получить sessid с khl.ru (статус ${lastStatus})`);
    }
    return { cookie: cookieJar.join("; "), sessid: match[1] };
  }

  private async getSession(): Promise<Session> {
    const now = Date.now();
    if (this.session && now < this.sessionExpiresAt) return this.session;

    let session: Session;
    try {
      session = await this.getSessionOnce();
    } catch (error) {
      console.warn("getSession: первая попытка не удалась, повторяю:", error);
      session = await this.getSessionOnce();
    }

    this.session = session;
    this.sessionExpiresAt = now + this.SESSION_TTL_MS;
    return session;
  }

  private async fetchGameHeader(gameId: number, session: Session) {
    const response = await fetch(`${BASE_URL}/rest/game/header/`, {
      method: "POST",
      headers: {
        Accept: "application/json, */*",
        "Accept-Language": "ru-RU,ru;q=0.9",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        Origin: BASE_URL,
        Referer: `${BASE_URL}/game/${gameId}/`,
        Cookie: session.cookie,
      },
      body: new URLSearchParams({
        page: "preview",
        "values[tournament]": "1436",
        "values[gameid]": String(gameId),
        sessid: session.sessid,
      }).toString(),
    });

    if (!response.ok) throw new Error(`game/header ${gameId}: ${response.status}`);
    return response.json();
  }

  // ---- Prisma через Hyperdrive ----
  private getPrisma(): PrismaClient {
    const adapter = new PrismaPg({ connectionString: this.env.HYPERDRIVE.connectionString });
    return new PrismaClient({ adapter });
  }

  // ---- Главная логика тика: возвращает true, если сейчас есть live-игры ----
  private async checkAndSync(): Promise<boolean> {
    const prisma = this.getPrisma();
    try {
      const now = new Date();
      const windowStart = new Date(now);
      windowStart.setUTCDate(windowStart.getUTCDate() - 1);
      const windowEnd = new Date(now);
      windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

      const candidates = await prisma.game.findMany({
        where: {
          status: { not: "FINISHED" },
          date: { gte: windowStart, lte: windowEnd },
        },
        select: { id: true, date: true, timeFormat: true, status: true },
      });

      if (candidates.length === 0) return false;

      const session = await this.getSession();
      let anyLive = false;

      for (const candidate of candidates) {
        const startsAt = gameStartMoscow(candidate.date, candidate.timeFormat);
        console.log(`game ${candidate.id}: status=${candidate.status}, startsAt=${startsAt?.toISOString()}, now=${now.toISOString()}`);

        if (startsAt && now.getTime() < startsAt.getTime() - 5 * 60 * 1000) {
          console.log(`  -> skip: ещё не начался`);
          continue;
        }
        if (startsAt && now.getTime() > startsAt.getTime() + 4 * 60 * 60 * 1000) {
          console.log(`  -> skip: слишком давно должен был закончиться`);
          continue;
        }

        console.log(`  -> запрашиваю game/header`);
        let rawResponse: KhlGameHeaderResponse;
        try {
          rawResponse = (await this.fetchGameHeader(candidate.id, session)) as KhlGameHeaderResponse;
        } catch (error) {
          console.warn(`  -> game/header failed for ${candidate.id}:`, error);
          continue;
        }

        const header = "data" in rawResponse ? rawResponse.data : rawResponse;
        console.log(`  -> isOnline=${header?.isOnline}`);
        if (!header) continue;

        const isLive = Boolean(header.isOnline);
        const normalized = normalizeGameHeader(header);

        await prisma.game.update({
          where: { id: candidate.id },
          data: {
            ...(isLive ? { status: "LIVE" as const } : {}),
            ...(normalized.score?.home != null ? { homeScore: Number(normalized.score.home) } : {}),
            ...(normalized.score?.away != null ? { visitorScore: Number(normalized.score.away) } : {}),
            liveStatus: normalized.status ?? null,
            livePeriod: normalized.period ?? null,
            liveClock: normalized.time ?? null,
            liveEvents: normalized.goals ?? undefined,
            liveUpdatedAt: new Date(),
          },
        });

        if (isLive) anyLive = true;
      }

      return anyLive;
    } finally {
      await prisma.$disconnect();
    }
  }
}