import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { validateApiKey, unauthorizedResponse } from "@/lib/mcp-auth";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  const status = request.nextUrl.searchParams.get("status");
  const clientName = request.nextUrl.searchParams.get("client");
  const search = request.nextUrl.searchParams.get("search");

  let rows = await db
    .select({
      id: schema.quotes.id,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      clientName: schema.clients.name,
      projectName: schema.projects.name,
      fxRate: schema.quotes.fxRate,
      defaultMargin: schema.quotes.defaultMargin,
      gstRate: schema.quotes.gstRate,
      screenSize: schema.quotes.screenSize,
      panelConfig: schema.quotes.panelConfig,
      totalResolution: schema.quotes.totalResolution,
      cachedTotalUsd: schema.quotes.cachedTotalUsd,
      cachedTotalAudCost: schema.quotes.cachedTotalAudCost,
      cachedTotalAudSellExGst: schema.quotes.cachedTotalAudSellExGst,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit,
      validUntil: schema.quotes.validUntil,
      createdAt: schema.quotes.createdAt,
      updatedAt: schema.quotes.updatedAt,
    })
    .from(schema.quotes)
    .leftJoin(schema.projects, eq(schema.quotes.projectId, schema.projects.id))
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .orderBy(desc(schema.quotes.createdAt))
    .all();

  type Row = typeof rows[number];

  if (status) {
    rows = rows.filter((r: Row) => r.status === status);
  }
  if (clientName) {
    const lc = clientName.toLowerCase();
    rows = rows.filter((r: Row) => r.clientName?.toLowerCase().includes(lc));
  }
  if (search) {
    const lc = search.toLowerCase();
    rows = rows.filter(
      (r: Row) =>
        r.name.toLowerCase().includes(lc) ||
        r.quoteNumber.toLowerCase().includes(lc) ||
        r.clientName?.toLowerCase().includes(lc) ||
        r.projectName?.toLowerCase().includes(lc)
    );
  }

  return Response.json({
    count: rows.length,
    quotes: rows,
  });
}
