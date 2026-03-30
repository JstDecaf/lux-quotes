import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { ClientDetail } from "@/components/client-detail";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clientId = parseInt(id);

  const client = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId)).get();
  if (!client) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Client not found</h1>
        <a href="/clients" className="text-[#DB412B] hover:underline mt-4 inline-block">Back to Clients</a>
      </div>
    );
  }

  const projects = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.clientId, clientId))
    .all();

  // Get quotes for each project
  const projectsWithQuotes = await Promise.all(projects.map(async (p: any) => {
    const quotes = await db
      .select({
        id: schema.quotes.id,
        quoteNumber: schema.quotes.quoteNumber,
        name: schema.quotes.name,
        status: schema.quotes.status,
        cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      })
      .from(schema.quotes)
      .where(eq(schema.quotes.projectId, p.id))
      .all();
    return { ...p, quotes };
  }));

  return <ClientDetail client={client} projects={projectsWithQuotes} />;
}
