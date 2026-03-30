import { db, schema } from "./db";
import { eq } from "drizzle-orm";
import { calculateQuoteTotals } from "./calculations";

export async function recalcQuoteTotals(quoteId: number) {
  const quote = await db.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId)).get();
  if (!quote) return;

  const items = await db.select().from(schema.quoteLineItems).where(eq(schema.quoteLineItems.quoteId, quoteId)).all();

  const settings = {
    fxRate: quote.fxRate,
    defaultMargin: quote.defaultMargin,
    defaultResellerMargin: quote.defaultResellerMargin,
    gstRate: quote.gstRate,
    depositPct: quote.depositPct,
    secondTranchePct: quote.secondTranchePct,
  };
  const inputs = items.map((item: any) => ({
    qty: item.qty,
    usdUnitPrice: item.usdUnitPrice ?? 0,
    marginOverride: item.marginOverride,
    resellerMarginOverride: item.resellerMarginOverride,
    isLocal: item.isLocal,
    audLocalCost: item.audLocalCost ?? 0,
    isFree: item.isFree,
  }));

  const totals = calculateQuoteTotals(inputs, settings);

  await db.update(schema.quotes)
    .set({
      cachedTotalUsd: totals.totalUsd,
      cachedTotalAudCost: totals.totalAudCost,
      cachedTotalAudSellExGst: totals.totalAudSellExGst,
      cachedTotalAudSellIncGst: totals.totalAudSellIncGst,
      cachedTotalGrossProfit: totals.totalGrossProfit,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.quotes.id, quoteId))
    .run();
}
