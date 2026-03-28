export interface LineItemInput {
  qty: number;
  usdUnitPrice: number;
  marginOverride: number | null;
  isLocal: boolean;
  audLocalCost: number;
  isFree: boolean;
}

export interface QuoteSettings {
  fxRate: number;
  defaultMargin: number;
  gstRate: number;
}

export interface LineItemCalculated {
  usdSubtotal: number;
  audCost: number;
  audSellExGst: number;
  gst: number;
  audSellIncGst: number;
  grossProfit: number;
}

export function calculateLineItem(
  item: LineItemInput,
  settings: QuoteSettings
): LineItemCalculated {
  if (item.isFree) {
    return {
      usdSubtotal: 0,
      audCost: 0,
      audSellExGst: 0,
      gst: 0,
      audSellIncGst: 0,
      grossProfit: 0,
    };
  }

  const margin = item.marginOverride ?? settings.defaultMargin;
  const usdSubtotal = item.isLocal ? 0 : item.qty * item.usdUnitPrice;
  const audCost = item.isLocal
    ? item.audLocalCost
    : settings.fxRate > 0
      ? usdSubtotal / settings.fxRate
      : 0;
  const audSellExGst = margin < 1 ? audCost / (1 - margin) : audCost;
  const gst = audSellExGst * settings.gstRate;
  const audSellIncGst = audSellExGst + gst;
  const grossProfit = audSellExGst - audCost;

  return { usdSubtotal, audCost, audSellExGst, gst, audSellIncGst, grossProfit };
}

export function calculateQuoteTotals(
  items: LineItemInput[],
  settings: QuoteSettings
) {
  let totalUsd = 0;
  let totalAudCost = 0;
  let totalAudSellExGst = 0;
  let totalGst = 0;
  let totalAudSellIncGst = 0;
  let totalGrossProfit = 0;

  for (const item of items) {
    const calc = calculateLineItem(item, settings);
    totalUsd += calc.usdSubtotal;
    totalAudCost += calc.audCost;
    totalAudSellExGst += calc.audSellExGst;
    totalGst += calc.gst;
    totalAudSellIncGst += calc.audSellIncGst;
    totalGrossProfit += calc.grossProfit;
  }

  const overallMargin =
    totalAudSellExGst > 0 ? totalGrossProfit / totalAudSellExGst : 0;

  return {
    totalUsd,
    totalAudCost,
    totalAudSellExGst,
    totalGst,
    totalAudSellIncGst,
    totalGrossProfit,
    overallMargin,
  };
}

export function formatCurrency(value: number, currency: "AUD" | "USD" = "AUD"): string {
  const prefix = currency === "USD" ? "US$" : "$";
  return `${prefix}${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
