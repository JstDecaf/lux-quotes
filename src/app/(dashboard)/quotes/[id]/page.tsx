import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

import { QuoteEditor } from "@/components/quote-editor";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quoteId = parseInt(id);

  const quote = await db
    .select({
      id: schema.quotes.id,
      projectId: schema.quotes.projectId,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      fxRate: schema.quotes.fxRate,
      defaultMargin: schema.quotes.defaultMargin,
      gstRate: schema.quotes.gstRate,
      defaultResellerMargin: schema.quotes.defaultResellerMargin,
      depositPct: schema.quotes.depositPct,
      secondTranchePct: schema.quotes.secondTranchePct,
      installationHourlyRate: schema.quotes.installationHourlyRate,
      installationMargin: schema.quotes.installationMargin,
      screenSize: schema.quotes.screenSize,
      panelConfig: schema.quotes.panelConfig,
      totalResolution: schema.quotes.totalResolution,
      supplierQuoteDate: schema.quotes.supplierQuoteDate,
      supplierQuoteRef: schema.quotes.supplierQuoteRef,
      cachedTotalUsd: schema.quotes.cachedTotalUsd,
      cachedTotalAudCost: schema.quotes.cachedTotalAudCost,
      cachedTotalAudSellExGst: schema.quotes.cachedTotalAudSellExGst,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit,
      notes: schema.quotes.notes,
      validUntil: schema.quotes.validUntil,
      createdAt: schema.quotes.createdAt,
      updatedAt: schema.quotes.updatedAt,
      clientId: schema.clients.id,
      clientName: schema.clients.name,
      projectName: schema.projects.name,
    })
    .from(schema.quotes)
    .leftJoin(schema.projects, eq(schema.quotes.projectId, schema.projects.id))
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .where(eq(schema.quotes.id, quoteId))
    .get();

  if (!quote) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Quote not found</h1>
        <a href="/quotes" className="text-[#DB412B] hover:underline mt-4 inline-block">Back to Quotes</a>
      </div>
    );
  }

  const lineItems = await db
    .select({
      id: schema.quoteLineItems.id,
      quoteId: schema.quoteLineItems.quoteId,
      sortOrder: schema.quoteLineItems.sortOrder,
      itemName: schema.quoteLineItems.itemName,
      description: schema.quoteLineItems.description,
      unit: schema.quoteLineItems.unit,
      qty: schema.quoteLineItems.qty,
      usdUnitPrice: schema.quoteLineItems.usdUnitPrice,
      marginOverride: schema.quoteLineItems.marginOverride,
      resellerMarginOverride: schema.quoteLineItems.resellerMarginOverride,
      isLocal: schema.quoteLineItems.isLocal,
      audLocalCost: schema.quoteLineItems.audLocalCost,
      isFree: schema.quoteLineItems.isFree,
      productId: schema.quoteLineItems.productId,
      productVariantId: schema.quoteLineItems.productVariantId,
      createdAt: schema.quoteLineItems.createdAt,
      updatedAt: schema.quoteLineItems.updatedAt,
      productName: schema.products.name,
      variantName: schema.productVariants.name,
      pixelPitch: schema.productVariants.pixelPitch,
      variantWeight: schema.productVariants.weight,
    })
    .from(schema.quoteLineItems)
    .leftJoin(schema.productVariants, eq(schema.quoteLineItems.productVariantId, schema.productVariants.id))
    .leftJoin(schema.products, eq(schema.productVariants.productId, schema.products.id))
    .where(eq(schema.quoteLineItems.quoteId, quoteId))
    .orderBy(schema.quoteLineItems.sortOrder)
    .all();

  const installationItems = await db
    .select()
    .from(schema.quoteInstallationItems)
    .where(eq(schema.quoteInstallationItems.quoteId, quoteId))
    .orderBy(schema.quoteInstallationItems.sortOrder)
    .all();

  return <QuoteEditor initialQuote={quote} initialItems={lineItems} initialInstallationItems={installationItems} />;
}
