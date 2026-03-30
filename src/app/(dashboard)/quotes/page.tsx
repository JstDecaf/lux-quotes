import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { QuotesList } from "@/components/quotes-list";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const quotes = await db
    .select({
      id: schema.quotes.id,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit,
      createdAt: schema.quotes.createdAt,
      clientName: schema.clients.name,
      projectName: schema.projects.name,
      projectId: schema.quotes.projectId,
    })
    .from(schema.quotes)
    .leftJoin(schema.projects, eq(schema.quotes.projectId, schema.projects.id))
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .orderBy(desc(schema.quotes.createdAt))
    .all();

  // Get projects for the new quote form
  const projects = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      clientName: schema.clients.name,
    })
    .from(schema.projects)
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .all();

  return <QuotesList quotes={quotes} projects={projects} />;
}
