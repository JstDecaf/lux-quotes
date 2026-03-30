import { db, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { ProjectsList } from "@/components/projects-list";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await db
    .select({
      id: schema.projects.id,
      clientId: schema.projects.clientId,
      name: schema.projects.name,
      description: schema.projects.description,
      status: schema.projects.status,
      createdAt: schema.projects.createdAt,
      clientName: schema.clients.name,
    })
    .from(schema.projects)
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .orderBy(asc(schema.projects.name))
    .all();

  return <ProjectsList projects={projects} />;
}
