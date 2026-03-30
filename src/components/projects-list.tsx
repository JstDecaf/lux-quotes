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

const PROJECT_STATUSES: Record<string, string> = {
  active: "Active",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
  on_hold: "On Hold",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  quoted: "bg-blue-100 text-blue-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
  on_hold: "bg-yellow-100 text-yellow-700",
};

export function ProjectsList({ projects }: { projects: Project[] }) {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-archivo text-2xl font-bold text-gray-900">Projects</h1>
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-white rounded-lg border overflow-hidden">
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
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.clientName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>
                      {PROJECT_STATUSES[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.createdAt?.slice(0, 10)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {projects.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
            No projects yet. Create a project from a client page.
          </div>
        ) : (
          projects.map((p) => (
            <div
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}`)}
              className="bg-white rounded-lg border p-4 cursor-pointer hover:bg-gray-50 transition-colors active:bg-gray-100"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-medium text-gray-900">{p.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>
                  {PROJECT_STATUSES[p.status] || p.status}
                </span>
              </div>
              {p.description && (
                <p className="text-sm text-gray-500 mb-2 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{p.clientName ?? "-"}</span>
                <span>{p.createdAt?.slice(0, 10)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
