import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";

export const maxDuration = 30;

export async function POST() {
  const today = new Date().toISOString().split("T")[0];

  // 1. Fetch current AUD/USD rate
  let rateAudUsd: number;
  try {
    // exchangerate.host free tier
    const res = await fetch(
      `https://api.exchangerate.host/live?access_key=${process.env.EXCHANGERATE_API_KEY || ""}&source=AUD&currencies=USD&format=1`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) {
      // Fallback: try frankfurter.app (completely free, no key)
      const fallback = await fetch(
        `https://api.frankfurter.app/latest?from=AUD&to=USD`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!fallback.ok) throw new Error("Both FX APIs failed");
      const data = await fallback.json();
      rateAudUsd = data.rates?.USD;
    } else {
      const data = await res.json();
      if (data.success && data.quotes?.AUDUSD) {
        rateAudUsd = data.quotes.AUDUSD;
      } else {
        // Fallback
        const fallback = await fetch(
          `https://api.frankfurter.app/latest?from=AUD&to=USD`,
          { signal: AbortSignal.timeout(10000) }
        );
        const fbData = await fallback.json();
        rateAudUsd = fbData.rates?.USD;
      }
    }

    if (!rateAudUsd || isNaN(rateAudUsd)) {
      return NextResponse.json({ error: "Could not determine FX rate" }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: `FX fetch failed: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }

  // 2. Upsert into fx_rate_history
  const existing = await db.select().from(schema.fxRateHistory)
    .where(eq(schema.fxRateHistory.date, today)).get();

  if (existing) {
    await db.update(schema.fxRateHistory)
      .set({ rateAudUsd })
      .where(eq(schema.fxRateHistory.date, today)).run();
  } else {
    await db.insert(schema.fxRateHistory).values({ date: today, rateAudUsd }).run();
  }

  // 3. Recalculate P/L snapshots for active/sent quotes
  const activeStatuses = ["active", "sent"];
  const quotes = await db.select({
    id: schema.quotes.id,
    fxRate: schema.quotes.fxRate,
    cachedTotalUsd: schema.quotes.cachedTotalUsd,
    status: schema.quotes.status,
  }).from(schema.quotes).all();

  const eligibleQuotes = quotes.filter(
    (q: typeof quotes[number]) => activeStatuses.includes(q.status) && (q.cachedTotalUsd ?? 0) > 0
  );

  let snapshotsUpdated = 0;

  for (const q of eligibleQuotes) {
    const totalUsd = q.cachedTotalUsd ?? 0;
    const quotedRate = q.fxRate;

    // P/L impact: positive means you're saving money
    // audCostAtQuotedRate - audCostAtMarketRate
    const audCostAtQuoted = totalUsd / quotedRate;
    const audCostAtMarket = totalUsd / rateAudUsd;
    const plImpact = audCostAtQuoted - audCostAtMarket;

    // Upsert snapshot for today
    const existingSnap = await db.select().from(schema.quoteFxSnapshots)
      .where(eq(schema.quoteFxSnapshots.quoteId, q.id))
      .all();

    const todaySnap = existingSnap.find((s: typeof existingSnap[number]) => s.date === today);

    if (todaySnap) {
      await db.update(schema.quoteFxSnapshots)
        .set({ marketRate: rateAudUsd, quotedRate, totalUsdCost: totalUsd, plImpactAud: plImpact })
        .where(eq(schema.quoteFxSnapshots.id, todaySnap.id)).run();
    } else {
      await db.insert(schema.quoteFxSnapshots).values({
        quoteId: q.id,
        date: today,
        marketRate: rateAudUsd,
        quotedRate,
        totalUsdCost: totalUsd,
        plImpactAud: plImpact,
      }).run();
    }
    snapshotsUpdated++;
  }

  return NextResponse.json({
    date: today,
    rateAudUsd,
    quotesProcessed: snapshotsUpdated,
  });
}

// Allow GET for easy manual triggering / health check
export async function GET() {
  const latest = await db.select().from(schema.fxRateHistory)
    .orderBy(schema.fxRateHistory.date)
    .all();

  return NextResponse.json({
    count: latest.length,
    latest: latest.length > 0 ? latest[latest.length - 1] : null,
  });
}
