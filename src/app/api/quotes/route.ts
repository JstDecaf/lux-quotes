import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { generateQuoteNumber } from "@/lib/quote-number";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const projectId = request.nextUrl.searchParams.get("projectId");

  let rows = db
    .select({
      id: schema.quotes.id,
      projectId: schema.quotes.projectId,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      fxRate: schema.quotes.fxRate,
      defaultMargin: schema.quotes.defaultMargin,
      gstRate: schema.quotes.gstRate,
      cachedTotalUsd: schema.quotes.cachedTotalUsd,
      cachedTotalAudCost: schema.quotes.cachedTotalAudCost,
      cachedTotalAudSellExGst: schema.quotes.cachedTotalAudSellExGst,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit,
      createdAt: schema.quotes.createdAt,
      updatedAt: schema.quotes.updatedAt,
      clientName: schema.clients.name,
      projectName: schema.projects.name,
    })
    .from(schema.quotes)
    .leftJoin(schema.projects, eq(schema.quotes.projectId, schema.projects.id))
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .orderBy(desc(schema.quotes.createdAt))
    .all();

  if (status) {
    rows = rows.filter(r => r.status === status);
  }
  if (projectId) {
    rows = rows.filter(r => r.projectId === parseInt(projectId));
  }

  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { projectId, name, fxRate, defaultMargin, gstRate, screenSize, panelConfig, totalResolution, supplierQuoteDate, notes } = body;

  if (!projectId || !name) {
    return Response.json({ error: "projectId and name are required" }, { status: 400 });
  }

  const quoteNumber = generateQuoteNumber();

  const result = db.insert(schema.quotes).values({
    projectId,
    quoteNumber,
    name,
    fxRate: fxRate ?? 0.625,
    defaultMargin: defaultMargin ?? 0.5,
    gstRate: gstRate ?? 0.1,
    screenSize: screenSize ?? null,
    panelConfig: panelConfig ?? null,
    totalResolution: totalResolution ?? null,
    supplierQuoteDate: supplierQuoteDate ?? null,
    notes: notes ?? null,
  }).returning().get();

  return Response.json(result, { status: 201 });
}
