import { db, schema } from "@/lib/db";
import { eq, asc, desc } from "drizzle-orm";
import { validateApiKey, unauthorizedResponse } from "@/lib/mcp-auth";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  const clientId = request.nextUrl.searchParams.get("clientId");

  let projectRows = await db
    .select({
      id: schema.projects.id,
      clientId: schema.projects.clientId,
      name: schema.projects.name,
      description: schema.projects.description,
      status: schema.projects.status,
      clientName: schema.clients.name,
      createdAt: schema.projects.createdAt,
      updatedAt: schema.projects.updatedAt,
    })
    .from(schema.projects)
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .orderBy(asc(schema.projects.name))
    .all();

  if (clientId) {
    projectRows = projectRows.filter((p: typeof projectRows[number]) => p.clientId === parseInt(clientId));
  }

  // Enrich with quote summary
  const enriched = await Promise.all(
    projectRows.map(async (project: typeof projectRows[number]) => {
      const quotes = await db
        .select({
          id: schema.quotes.id,
          quoteNumber: schema.quotes.quoteNumber,
          name: schema.quotes.name,
          status: schema.quotes.status,
          cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
        })
        .from(schema.quotes)
        .where(eq(schema.quotes.projectId, project.id))
        .orderBy(desc(schema.quotes.createdAt))
        .all();

      return { ...project, quoteCount: quotes.length, quotes };
    })
  );

  return Response.json({
    count: enriched.length,
    projects: enriched,
  });
}
