import { NextResponse } from "next/server";
import { getStandingsSafe } from "@/lib/standings";

export const revalidate = 60;

export async function GET() {
  const standings = await getStandingsSafe();
  return NextResponse.json(standings, {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    },
  });
}
