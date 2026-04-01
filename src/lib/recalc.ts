import { db, schema } from "./db";
import { eq } from "drizzle-orm";
import { calculateQuoteTotals, calculateInstallationTotals } from "./calculations";

export async function recalcQuoteTotals(quoteId: number) {
  const quote = await db.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId)).get();
  if (!quote) return;

  const items = await db.select().from(schema.quoteLineItems).where(eq(schema.quoteLineItems.quoteId, quoteId)).all();
  const installItems = await db.select().from(schema.quoteInstallationItems).where(eq(schema.quoteInstallationItems.quoteId, quoteId)).all();

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

  const installInputs = installItems.map((item: any) => ({
    type: item.type as "hourly" | "fixed",
    hours: item.hours ?? 0,
    hourlyRate: item.hourlyRate,
    fixedCost: item.fixedCost ?? 0,
    marginOverride: item.marginOverride,
    isFree: item.isFree,
  }));

  const totals = calculateQuoteTotals(inputs, settings);
  const installTotals = calculateInstallationTotals(installInputs, {
    defaultHourlyRate: quote.installationHourlyRate,
    defaultInstallationMargin: quote.installationMargin,
    gstRate: quote.gstRate,
  });

  await db.update(schema.quotes)
    .set({
      cachedTotalUsd: totals.totalUsd,
      cachedTotalAudCost: totals.totalAudCost + installTotals.totalCost,
      cachedTotalAudSellExGst: totals.totalAudSellExGst + installTotals.totalSellExGst,
      cachedTotalAudSellIncGst: totals.totalAudSellIncGst + installTotals.totalSellIncGst,
      cachedTotalGrossProfit: totals.totalGrossProfit + installTotals.totalGrossProfit,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.quotes.id, quoteId))
    .run();
}
