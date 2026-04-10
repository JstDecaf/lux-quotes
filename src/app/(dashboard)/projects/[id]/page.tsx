import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { ProjectDetail } from "@/components/project-detail";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = parseInt(id);

  const project = await db
    .select({
      id: schema.projects.id,
      clientId: schema.projects.clientId,
      name: schema.projects.name,
      description: schema.projects.description,
      status: schema.projects.status,
      createdAt: schema.projects.createdAt,
      updatedAt: schema.projects.updatedAt,
      clientName: schema.clients.name,
    })
    .from(schema.projects)
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .where(eq(schema.projects.id, projectId))
    .get();

  if (!project) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Project not found</h1>
        <a href="/projects" className="text-[#DB412B] hover:underline mt-4 inline-block">Back to Projects</a>
      </div>
    );
  }

  const quotes = await db
    .select({
      id: schema.quotes.id,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
    })
    .from(schema.quotes)
    .where(eq(schema.quotes.projectId, projectId))
    .all();

  return <ProjectDetail project={{ ...project, quotes }} />;
}
