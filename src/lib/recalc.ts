import { db, schema } from "./db";
import { eq } from "drizzle-orm";
import { calculateQuoteTotals } from "./calculations";

export function recalcQuoteTotals(quoteId: number) {
  const quote = db.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId)).get();
  if (!quote) return;

  const items = db.select().from(schema.quoteLineItems).where(eq(schema.quoteLineItems.quoteId, quoteId)).all();

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

  db.update(schema.quotes)
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
