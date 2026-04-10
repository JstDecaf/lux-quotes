import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, gte, lte, and } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { from, to, quoteId } = body as { from: string; to: string; quoteId?: number };

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates required (YYYY-MM-DD)" }, { status: 400 });
  }

  // 1. Fetch historical rates from frankfurter.app (free, supports date ranges)
  let dailyRates: Record<string, number> = {};
  try {
    const res = await fetch(
      `https://api.frankfurter.app/${from}..${to}?from=AUD&to=USD`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    // data.rates is { "2026-03-28": { "USD": 0.6321 }, ... }
    if (data.rates) {
      for (const [date, currencies] of Object.entries(data.rates)) {
        const usd = (currencies as Record<string, number>).USD;
        if (usd) dailyRates[date] = usd;
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch historical rates: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }

  const dates = Object.keys(dailyRates).sort();
  if (dates.length === 0) {
    return NextResponse.json({ error: "No rate data available for this period" }, { status: 404 });
  }

  // 2. Upsert into fx_rate_history
  let ratesInserted = 0;
  for (const date of dates) {
    const existing = await db.select().from(schema.fxRateHistory)
      .where(eq(schema.fxRateHistory.date, date)).get();

    if (!existing) {
      await db.insert(schema.fxRateHistory).values({
        date,
        rateAudUsd: dailyRates[date],
      }).run();
      ratesInserted++;
    }
  }

  // 3. If a quoteId was provided, backfill P/L snapshots for that quote
  let snapshotsCreated = 0;
  if (quoteId) {
    const quote = await db.select({
      id: schema.quotes.id,
      fxRate: schema.quotes.fxRate,
      cachedTotalUsd: schema.quotes.cachedTotalUsd,
    }).from(schema.quotes).where(eq(schema.quotes.id, quoteId)).get();

    if (quote && (quote.cachedTotalUsd ?? 0) > 0) {
      const totalUsd = quote.cachedTotalUsd ?? 0;
      const quotedRate = quote.fxRate;

      for (const date of dates) {
        const marketRate = dailyRates[date];
        const plImpact = (totalUsd / quotedRate) - (totalUsd / marketRate);

        const existingSnap = await db.select().from(schema.quoteFxSnapshots)
          .where(and(
            eq(schema.quoteFxSnapshots.quoteId, quoteId),
            eq(schema.quoteFxSnapshots.date, date)
          )).get();

        if (!existingSnap) {
          await db.insert(schema.quoteFxSnapshots).values({
            quoteId,
            date,
            marketRate,
            quotedRate,
            totalUsdCost: totalUsd,
            plImpactAud: plImpact,
          }).run();
          snapshotsCreated++;
        }
      }
    }
  }

  return NextResponse.json({
    datesAvailable: dates.length,
    ratesInserted,
    snapshotsCreated,
    from: dates[0],
    to: dates[dates.length - 1],
  });
}
