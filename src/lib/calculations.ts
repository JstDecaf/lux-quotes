export interface LineItemInput {
  qty: number;
  usdUnitPrice: number;
  marginOverride: number | null;
  resellerMarginOverride: number | null;
  isLocal: boolean;
  audLocalCost: number;
  isFree: boolean;
}

export interface QuoteSettings {
  fxRate: number;
  defaultMargin: number;
  defaultResellerMargin: number;
  gstRate: number;
  depositPct: number;
  secondTranchePct: number;
}

export interface LineItemCalculated {
  usdSubtotal: number;
  audCost: number;
  audSellExGst: number;
  gst: number;
  audSellIncGst: number;
  grossProfit: number;
  resellerSellExGst: number;
  resellerGst: number;
  resellerSellIncGst: number;
  resellerProfit: number;
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
      resellerSellExGst: 0,
      resellerGst: 0,
      resellerSellIncGst: 0,
      resellerProfit: 0,
    };
  }

  const margin = item.marginOverride ?? settings.defaultMargin;
  const resellerMargin = item.resellerMarginOverride ?? settings.defaultResellerMargin;

  const usdSubtotal = item.isLocal ? 0 : item.qty * item.usdUnitPrice;
  const audCost = item.isLocal
    ? item.audLocalCost
    : settings.fxRate > 0
      ? usdSubtotal / settings.fxRate
      : 0;

  // LUX sell price (what LUX charges the reseller)
  const audSellExGst = margin < 1 ? audCost / (1 - margin) : audCost;
  const gst = audSellExGst * settings.gstRate;
  const audSellIncGst = audSellExGst + gst;
  const grossProfit = audSellExGst - audCost;

  // Reseller sell price (what the reseller charges the end client)
  const resellerSellExGst = resellerMargin < 1
    ? audSellExGst / (1 - resellerMargin)
    : audSellExGst;
  const resellerGst = resellerSellExGst * settings.gstRate;
  const resellerSellIncGst = resellerSellExGst + resellerGst;
  const resellerProfit = resellerSellExGst - audSellExGst;

  return {
    usdSubtotal,
    audCost,
    audSellExGst,
    gst,
    audSellIncGst,
    grossProfit,
    resellerSellExGst,
    resellerGst,
    resellerSellIncGst,
    resellerProfit,
  };
}

export interface QuoteTotals {
  totalUsd: number;
  totalAudCost: number;
  totalAudSellExGst: number;
  totalGst: number;
  totalAudSellIncGst: number;
  totalGrossProfit: number;
  overallMargin: number;
  totalResellerSellExGst: number;
  totalResellerGst: number;
  totalResellerSellIncGst: number;
  totalResellerProfit: number;
  depositAmount: number;
  secondTrancheAmount: number;
  balanceAmount: number;
}

export function calculateQuoteTotals(
  items: LineItemInput[],
  settings: QuoteSettings
): QuoteTotals {
  let totalUsd = 0;
  let totalAudCost = 0;
  let totalAudSellExGst = 0;
  let totalGst = 0;
  let totalAudSellIncGst = 0;
  let totalGrossProfit = 0;
  let totalResellerSellExGst = 0;
  let totalResellerGst = 0;
  let totalResellerSellIncGst = 0;
  let totalResellerProfit = 0;

  for (const item of items) {
    const calc = calculateLineItem(item, settings);
    totalUsd += calc.usdSubtotal;
    totalAudCost += calc.audCost;
    totalAudSellExGst += calc.audSellExGst;
    totalGst += calc.gst;
    totalAudSellIncGst += calc.audSellIncGst;
    totalGrossProfit += calc.grossProfit;
    totalResellerSellExGst += calc.resellerSellExGst;
    totalResellerGst += calc.resellerGst;
    totalResellerSellIncGst += calc.resellerSellIncGst;
    totalResellerProfit += calc.resellerProfit;
  }

  const overallMargin =
    totalAudSellExGst > 0 ? totalGrossProfit / totalAudSellExGst : 0;

  // Deposit calculations based on reseller sell inc-GST (client-facing total)
  const depositAmount = totalResellerSellIncGst * settings.depositPct;
  const secondTrancheAmount = totalResellerSellIncGst * settings.secondTranchePct;
  const balanceAmount = totalResellerSellIncGst - depositAmount - secondTrancheAmount;

  return {
    totalUsd,
    totalAudCost,
    totalAudSellExGst,
    totalGst,
    totalAudSellIncGst,
    totalGrossProfit,
    overallMargin,
    totalResellerSellExGst,
    totalResellerGst,
    totalResellerSellIncGst,
    totalResellerProfit,
    depositAmount,
    secondTrancheAmount,
    balanceAmount,
  };
}

export function formatCurrency(value: number, currency: "AUD" | "USD" = "AUD"): string {
  const prefix = currency === "USD" ? "US$" : "$";
  return `${prefix}${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
