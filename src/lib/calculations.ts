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
  const audSellExGst = audCost * (1 + margin);
  const gst = audSellExGst * settings.gstRate;
  const audSellIncGst = audSellExGst + gst;
  const grossProfit = audSellExGst - audCost;

  // Reseller sell price (what the reseller charges the end client)
  const resellerSellExGst = audSellExGst * (1 + resellerMargin);
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
    totalAudCost > 0 ? totalGrossProfit / totalAudCost : 0;

  // Deposit calculations based on LUX sell inc-GST (what LUX collects from the reseller)
  const depositAmount = totalAudSellIncGst * settings.depositPct;
  const secondTrancheAmount = totalAudSellIncGst * settings.secondTranchePct;
  const balanceAmount = totalAudSellIncGst - depositAmount - secondTrancheAmount;

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

// ── Installation items ───────────────────────────────────────────────────────

export interface InstallationItemInput {
  type: "hourly" | "fixed";
  hours: number;
  hourlyRate: number | null;    // null = use defaultHourlyRate from settings
  fixedCost: number;
  marginOverride: number | null; // null = use defaultInstallationMargin
  isFree: boolean;
}

export interface InstallationSettings {
  defaultHourlyRate: number;
  defaultInstallationMargin: number;
  gstRate: number;
}

export interface InstallationItemCalculated {
  cost: number;
  sellExGst: number;
  gst: number;
  sellIncGst: number;
  grossProfit: number;
}

export function calculateInstallationItem(
  item: InstallationItemInput,
  settings: InstallationSettings
): InstallationItemCalculated {
  if (item.isFree) {
    return { cost: 0, sellExGst: 0, gst: 0, sellIncGst: 0, grossProfit: 0 };
  }

  const rate = item.hourlyRate ?? settings.defaultHourlyRate;
  const cost = item.type === "hourly" ? item.hours * rate : item.fixedCost;
  const margin = item.marginOverride ?? settings.defaultInstallationMargin;

  const sellExGst = cost * (1 + margin);
  const gst = sellExGst * settings.gstRate;
  const sellIncGst = sellExGst + gst;
  const grossProfit = sellExGst - cost;

  return { cost, sellExGst, gst, sellIncGst, grossProfit };
}

export interface InstallationTotals {
  totalCost: number;
  totalSellExGst: number;
  totalGst: number;
  totalSellIncGst: number;
  totalGrossProfit: number;
}

export function calculateInstallationTotals(
  items: InstallationItemInput[],
  settings: InstallationSettings
): InstallationTotals {
  let totalCost = 0, totalSellExGst = 0, totalGst = 0, totalSellIncGst = 0, totalGrossProfit = 0;
  for (const item of items) {
    const c = calculateInstallationItem(item, settings);
    totalCost += c.cost;
    totalSellExGst += c.sellExGst;
    totalGst += c.gst;
    totalSellIncGst += c.sellIncGst;
    totalGrossProfit += c.grossProfit;
  }
  return { totalCost, totalSellExGst, totalGst, totalSellIncGst, totalGrossProfit };
}

export function formatCurrency(value: number, currency: "AUD" | "USD" = "AUD"): string {
  const prefix = currency === "USD" ? "US$" : "$";
  return `${prefix}${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ── Screen info helpers ─────────────────────────────────────────────────────

export function computeScreenSqm(widthMm: number | null, heightMm: number | null): number | null {
  if (!widthMm || !heightMm) return null;
  return (widthMm * heightMm) / 1_000_000;
}

export function computeAspectRatio(w: number | null, h: number | null): string | null {
  if (!w || !h) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(Math.round(w), Math.round(h));
  const rw = Math.round(w) / d;
  const rh = Math.round(h) / d;
  // If numbers are unwieldy, show decimal ratio instead
  if (rw > 50 || rh > 50) return `${(w / h).toFixed(2)}:1`;
  return `${rw}:${rh}`;
}

export function computeTotalPanels(countW: number | null, countH: number | null): number | null {
  if (!countW || !countH) return null;
  return countW * countH;
}

export function computeTotalWeightKg(
  panelCountW: number | null,
  panelCountH: number | null,
  cabinetWeightKg: number | null
): number | null {
  const total = computeTotalPanels(panelCountW, panelCountH);
  if (!total || !cabinetWeightKg) return null;
  return total * cabinetWeightKg;
}

export interface ScreenSqmReconciliation {
  screenSqm: number | null;
  lineItemSqm: number | null;
  match: "ok" | "mismatch" | "no_data";
}

export function reconcileScreenSqm(
  widthMm: number | null,
  heightMm: number | null,
  lineItems: Array<{ unit: string; qty: number; isFree: boolean }>
): ScreenSqmReconciliation {
  const screenSqm = computeScreenSqm(widthMm, heightMm);
  const sqmItems = lineItems.filter((i) => i.unit === "SQM" && !i.isFree);
  const lineItemSqm = sqmItems.length > 0
    ? sqmItems.reduce((sum, i) => sum + i.qty, 0)
    : null;

  if (!screenSqm || !lineItemSqm) return { screenSqm, lineItemSqm, match: "no_data" };
  const diff = Math.abs(screenSqm - lineItemSqm);
  const match = diff < 0.1 ? "ok" : "mismatch";
  return { screenSqm, lineItemSqm, match };
}
