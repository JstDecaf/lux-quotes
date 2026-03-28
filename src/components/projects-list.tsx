"use client";

import { useRouter } from "next/navigation";

interface Project {
  id: number;
  clientId: number;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  clientName: string | null;
}

export function ProjectsList({ projects }: { projects: Project[] }) {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-archivo text-2xl font-bold text-gray-900">Projects</h1>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
              <th className="px-4 py-3 text-left">Project Name</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No projects yet. Create a project from a client page.
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/clients/${p.clientId}`)}
                  className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.clientName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.createdAt?.slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
