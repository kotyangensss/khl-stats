import { NextResponse } from "next/server";
import { computeStandings } from "@/lib/standings";

export async function GET() {
  const standings = await computeStandings();
  return NextResponse.json(standings);
}
