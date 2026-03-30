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

  const quote = db
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

  const lineItems = db
    .select()
    .from(schema.quoteLineItems)
    .where(eq(schema.quoteLineItems.quoteId, quoteId))
    .orderBy(schema.quoteLineItems.sortOrder)
    .all();

  return <QuoteEditor initialQuote={quote} initialItems={lineItems} />;
}
