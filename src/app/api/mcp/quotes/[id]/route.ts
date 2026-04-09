import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { validateApiKey, unauthorizedResponse } from "@/lib/mcp-auth";
import {
  calculateLineItem,
  calculateQuoteTotals,
  calculateInstallationItem,
  calculateInstallationTotals,
  computeScreenSqm,
  computeAspectRatio,
  computeTotalPanels,
  computeTotalWeightKg,
  type QuoteSettings,
  type InstallationSettings,
} from "@/lib/calculations";
import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  const { id } = await params;
  const quoteId = parseInt(id);

  if (isNaN(quoteId)) {
    return Response.json({ error: "Invalid quote ID" }, { status: 400 });
  }

  // Fetch quote with joined client/project info
  const quote = await db
    .select({
      id: schema.quotes.id,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      fxRate: schema.quotes.fxRate,
      defaultMargin: schema.quotes.defaultMargin,
      defaultResellerMargin: schema.quotes.defaultResellerMargin,
      gstRate: schema.quotes.gstRate,
      depositPct: schema.quotes.depositPct,
      secondTranchePct: schema.quotes.secondTranchePct,
      installationHourlyRate: schema.quotes.installationHourlyRate,
      installationMargin: schema.quotes.installationMargin,
      installationQuotedBy: schema.quotes.installationQuotedBy,
      screenSize: schema.quotes.screenSize,
      panelConfig: schema.quotes.panelConfig,
      totalResolution: schema.quotes.totalResolution,
      screenWidthMm: schema.quotes.screenWidthMm,
      screenHeightMm: schema.quotes.screenHeightMm,
      pixelPitchMm: schema.quotes.pixelPitchMm,
      cabinetWidthMm: schema.quotes.cabinetWidthMm,
      cabinetHeightMm: schema.quotes.cabinetHeightMm,
      panelCountW: schema.quotes.panelCountW,
      panelCountH: schema.quotes.panelCountH,
      resolutionW: schema.quotes.resolutionW,
      resolutionH: schema.quotes.resolutionH,
      brightnessNits: schema.quotes.brightnessNits,
      cabinetWeightKg: schema.quotes.cabinetWeightKg,
      supplierQuoteDate: schema.quotes.supplierQuoteDate,
      supplierQuoteRef: schema.quotes.supplierQuoteRef,
      notes: schema.quotes.notes,
      validUntil: schema.quotes.validUntil,
      createdAt: schema.quotes.createdAt,
      updatedAt: schema.quotes.updatedAt,
      clientId: schema.clients.id,
      clientName: schema.clients.name,
      projectId: schema.projects.id,
      projectName: schema.projects.name,
    })
    .from(schema.quotes)
    .leftJoin(schema.projects, eq(schema.quotes.projectId, schema.projects.id))
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .where(eq(schema.quotes.id, quoteId))
    .get();

  if (!quote) {
    return Response.json({ error: "Quote not found" }, { status: 404 });
  }

  // Fetch line items with product/variant info
  const rawLineItems = await db
    .select()
    .from(schema.quoteLineItems)
    .where(eq(schema.quoteLineItems.quoteId, quoteId))
    .orderBy(schema.quoteLineItems.sortOrder)
    .all();

  // Fetch installation items
  const rawInstallItems = await db
    .select()
    .from(schema.quoteInstallationItems)
    .where(eq(schema.quoteInstallationItems.quoteId, quoteId))
    .orderBy(schema.quoteInstallationItems.sortOrder)
    .all();

  // Calculate per-line-item figures (same as UI)
  const quoteSettings: QuoteSettings = {
    fxRate: quote.fxRate,
    defaultMargin: quote.defaultMargin,
    defaultResellerMargin: quote.defaultResellerMargin,
    gstRate: quote.gstRate,
    depositPct: quote.depositPct,
    secondTranchePct: quote.secondTranchePct,
  };

  const installSettings: InstallationSettings = {
    defaultHourlyRate: quote.installationHourlyRate,
    defaultInstallationMargin: quote.installationMargin,
    gstRate: quote.gstRate,
  };

  // Enrich line items with product names and computed prices
  const lineItems = await Promise.all(
    rawLineItems.map(async (item: typeof rawLineItems[number]) => {
      let productName: string | null = null;
      let variantName: string | null = null;
      let pixelPitch: string | null = null;

      if (item.productVariantId) {
        const variant = await db
          .select({
            name: schema.productVariants.name,
            pixelPitch: schema.productVariants.pixelPitch,
            productName: schema.products.name,
          })
          .from(schema.productVariants)
          .leftJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
          .where(eq(schema.productVariants.id, item.productVariantId))
          .get();
        productName = variant?.productName ?? null;
        variantName = variant?.name ?? null;
        pixelPitch = variant?.pixelPitch ?? null;
      }

      const calc = calculateLineItem(
        {
          qty: item.qty,
          usdUnitPrice: item.usdUnitPrice ?? 0,
          marginOverride: item.marginOverride,
          resellerMarginOverride: item.resellerMarginOverride,
          isLocal: item.isLocal,
          audLocalCost: item.audLocalCost ?? 0,
          isFree: item.isFree,
        },
        quoteSettings
      );

      return {
        id: item.id,
        sortOrder: item.sortOrder,
        itemName: item.itemName,
        description: item.description,
        unit: item.unit,
        qty: item.qty,
        usdUnitPrice: item.usdUnitPrice,
        marginOverride: item.marginOverride,
        isLocal: item.isLocal,
        audLocalCost: item.audLocalCost,
        isFree: item.isFree,
        productName,
        variantName,
        pixelPitch,
        calculated: calc,
      };
    })
  );

  // Enrich installation items with computed prices
  const installationItems = rawInstallItems.map((item: typeof rawInstallItems[number]) => {
    const calc = calculateInstallationItem(
      {
        type: item.type as "hourly" | "fixed",
        hours: item.hours ?? 0,
        hourlyRate: item.hourlyRate,
        fixedCost: item.fixedCost ?? 0,
        marginOverride: item.marginOverride,
        isFree: item.isFree,
      },
      installSettings
    );

    return {
      id: item.id,
      sortOrder: item.sortOrder,
      itemName: item.itemName,
      type: item.type,
      hours: item.hours,
      hourlyRate: item.hourlyRate ?? quote.installationHourlyRate,
      fixedCost: item.fixedCost,
      marginOverride: item.marginOverride,
      isFree: item.isFree,
      notes: item.notes,
      calculated: calc,
    };
  });

  // Calculate totals (same as UI)
  const productTotals = calculateQuoteTotals(
    rawLineItems.map((item: typeof rawLineItems[number]) => ({
      qty: item.qty,
      usdUnitPrice: item.usdUnitPrice ?? 0,
      marginOverride: item.marginOverride,
      resellerMarginOverride: item.resellerMarginOverride,
      isLocal: item.isLocal,
      audLocalCost: item.audLocalCost ?? 0,
      isFree: item.isFree,
    })),
    quoteSettings
  );

  const installTotals = calculateInstallationTotals(
    rawInstallItems.map((item: typeof rawInstallItems[number]) => ({
      type: item.type as "hourly" | "fixed",
      hours: item.hours ?? 0,
      hourlyRate: item.hourlyRate,
      fixedCost: item.fixedCost ?? 0,
      marginOverride: item.marginOverride,
      isFree: item.isFree,
    })),
    installSettings
  );

  // Screen info
  const screenSqm = computeScreenSqm(quote.screenWidthMm, quote.screenHeightMm);
  const aspectRatio = computeAspectRatio(quote.resolutionW, quote.resolutionH);
  const totalPanels = computeTotalPanels(quote.panelCountW, quote.panelCountH);
  const totalWeightKg = computeTotalWeightKg(quote.panelCountW, quote.panelCountH, quote.cabinetWeightKg);

  // Combined totals (products + installation)
  const combinedTotals = {
    totalAudCost: productTotals.totalAudCost + installTotals.totalCost,
    totalAudSellExGst: productTotals.totalAudSellExGst + installTotals.totalSellExGst,
    totalGst: productTotals.totalGst + installTotals.totalGst,
    totalAudSellIncGst: productTotals.totalAudSellIncGst + installTotals.totalSellIncGst,
    totalGrossProfit: productTotals.totalGrossProfit + installTotals.totalGrossProfit,
  };

  return Response.json({
    ...quote,
    screenInfo: {
      screenSqm,
      aspectRatio,
      totalPanels,
      totalWeightKg,
    },
    lineItems,
    installationItems,
    totals: {
      products: productTotals,
      installation: installTotals,
      combined: combinedTotals,
    },
  });
}
