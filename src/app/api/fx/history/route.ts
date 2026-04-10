import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { gte, lte, asc, and } from "drizzle-orm";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  let query = db.select().from(schema.fxRateHistory).orderBy(asc(schema.fxRateHistory.date));

  if (from && to) {
    const rows = await db.select().from(schema.fxRateHistory)
      .where(and(
        gte(schema.fxRateHistory.date, from),
        lte(schema.fxRateHistory.date, to)
      ))
      .orderBy(asc(schema.fxRateHistory.date))
      .all();
    return NextResponse.json(rows);
  }

  if (from) {
    const rows = await db.select().from(schema.fxRateHistory)
      .where(gte(schema.fxRateHistory.date, from))
      .orderBy(asc(schema.fxRateHistory.date))
      .all();
    return NextResponse.json(rows);
  }

  // Default: return last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
  const rows = await db.select().from(schema.fxRateHistory)
    .where(gte(schema.fxRateHistory.date, ninetyDaysAgo))
    .orderBy(asc(schema.fxRateHistory.date))
    .all();

  return NextResponse.json(rows);
}
