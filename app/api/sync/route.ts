import { NextRequest, NextResponse } from "next/server";
import { syncKhlData } from "@/lib/sync";

// GitHub Actions будет дёргать этот роут по расписанию с заголовком
// Authorization: Bearer <SYNC_SECRET>, чтобы никто посторонний не мог
// вызывать синхронизацию вручную и спамить запросами в khl.ru.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.SYNC_SECRET}`;

  if (!process.env.SYNC_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncKhlData();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Sync failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
