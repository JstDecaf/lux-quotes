import { db, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { validateApiKey, unauthorizedResponse } from "@/lib/mcp-auth";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  const clients = await db.select().from(schema.clients).orderBy(asc(schema.clients.name)).all();

  // Enrich with project count and quote count
  const enriched = await Promise.all(
    clients.map(async (client: typeof clients[number]) => {
      const projects = await db
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(eq(schema.projects.clientId, client.id))
        .all();

      let quoteCount = 0;
      for (const project of projects) {
        const quotes = await db
          .select({ id: schema.quotes.id })
          .from(schema.quotes)
          .where(eq(schema.quotes.projectId, project.id))
          .all();
        quoteCount += quotes.length;
      }

      return {
        ...client,
        projectCount: projects.length,
        quoteCount,
      };
    })
  );

  return Response.json({
    count: enriched.length,
    clients: enriched,
  });
}
