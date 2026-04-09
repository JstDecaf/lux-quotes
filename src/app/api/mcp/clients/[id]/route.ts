import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { validateApiKey, unauthorizedResponse } from "@/lib/mcp-auth";
import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  const { id } = await params;
  const clientId = parseInt(id);

  if (isNaN(clientId)) {
    return Response.json({ error: "Invalid client ID" }, { status: 400 });
  }

  const client = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.id, clientId))
    .get();

  if (!client) {
    return Response.json({ error: "Client not found" }, { status: 404 });
  }

  // Get all projects with their quotes
  const projects = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.clientId, clientId))
    .all();

  const projectsWithQuotes = await Promise.all(
    projects.map(async (project: typeof projects[number]) => {
      const quotes = await db
        .select({
          id: schema.quotes.id,
          quoteNumber: schema.quotes.quoteNumber,
          name: schema.quotes.name,
          status: schema.quotes.status,
          cachedTotalAudSellExGst: schema.quotes.cachedTotalAudSellExGst,
          cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
          cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit,
          createdAt: schema.quotes.createdAt,
          updatedAt: schema.quotes.updatedAt,
        })
        .from(schema.quotes)
        .where(eq(schema.quotes.projectId, project.id))
        .orderBy(desc(schema.quotes.createdAt))
        .all();

      return { ...project, quotes };
    })
  );

  return Response.json({
    ...client,
    projects: projectsWithQuotes,
  });
}
