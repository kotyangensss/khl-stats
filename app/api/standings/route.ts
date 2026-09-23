import { NextResponse } from "next/server";
import { getStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getStandings());
}
