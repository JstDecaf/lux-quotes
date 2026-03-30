"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface QuoteSummary {
  id: number;
  quoteNumber: string;
  name: string;
  status: string;
  cachedTotalAudSellIncGst: number | null;
}

interface Project {
  id: number;
  clientId: number;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  clientName: string | null;
  quotes: QuoteSummary[];
}

const PROJECT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "quoted", label: "Quoted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "on_hold", label: "On Hold" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  quoted: "bg-blue-100 text-blue-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
  on_hold: "bg-yellow-100 text-yellow-700",
};

const QUOTE_STATUS_COLORS: Record<string, string> = {
  draft: "#9CA3AF",
  sent: "#3B82F6",
  won: "#22C55E",
  lost: "#EF4444",
  expired: "#F59E0B",
  converted_to_pi: "#8B5CF6",
};

function fmt(val: number | null): string {
  if (val == null) return "$0.00";
  return "$" + val.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProjectDetail({ project: initialProject }: { project: Project }) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const saveProject = async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          description: project.description,
          status: project.status,
        }),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async () => {
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.push("/projects");
  };

  return (
    <div>
      <a href="/projects" className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-block">&larr; Back to Projects</a>

      {/* Project Info Card */}
      <div className="bg-white rounded-lg border p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                className="w-full border rounded px-3 py-2 text-2xl font-archivo font-bold text-[#0D1B2A]"
                value={project.name}
                onChange={(e) => setProject({ ...project, name: e.target.value })}
              />
            ) : (
              <h1 className="font-archivo text-2xl font-bold text-[#0D1B2A] truncate">{project.name}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button
                  onClick={saveProject}
                  disabled={saving}
                  className="px-4 py-1.5 bg-[#0D1B2A] text-white rounded text-sm hover:bg-[#1a2d42] disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setProject(initialProject); setEditing(false); }}
                  className="px-4 py-1.5 text-gray-500 text-sm border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border rounded hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="mb-4">
          {editing ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                className="border rounded px-3 py-2 text-sm"
                value={project.status}
                onChange={(e) => setProject({ ...project, status: e.target.value })}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] || "bg-gray-100 text-gray-600"}`}>
              {PROJECT_STATUSES.find((s) => s.value === project.status)?.label || project.status}
            </span>
          )}
        </div>

        {/* Description */}
        <div className="mb-4">
          {editing ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                value={project.description ?? ""}
                onChange={(e) => setProject({ ...project, description: e.target.value || null })}
                placeholder="Project description..."
              />
            </div>
          ) : (
            project.description && <p className="text-sm text-gray-600">{project.description}</p>
          )}
        </div>

        {/* Client Link */}
        {project.clientName && (
          <div className="text-sm text-gray-600 pt-3 border-t">
            Client:{" "}
            <a href={`/clients/${project.clientId}`} className="font-medium text-[#DB412B] hover:underline">
              {project.clientName}
            </a>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="font-bold text-lg mb-2">Delete Project?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete &ldquo;{project.name}&rdquo; and all its quotes. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-gray-500 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteProject}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quotes */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-archivo text-lg font-bold text-gray-900">Quotes</h2>
      </div>

      {project.quotes.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
          No quotes yet for this project.
        </div>
      ) : (
        <div className="space-y-2">
          {project.quotes.map((q) => (
            <a
              key={q.id}
              href={`/quotes/${q.id}`}
              className="flex items-center justify-between bg-white rounded-lg border p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-gray-400">{q.quoteNumber}</span>
                <span className="font-medium text-gray-900">{q.name}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: (QUOTE_STATUS_COLORS[q.status] ?? "#9CA3AF") + "20",
                    color: QUOTE_STATUS_COLORS[q.status] ?? "#9CA3AF",
                  }}
                >
                  {q.status}
                </span>
              </div>
              <span className="font-medium text-gray-700">{fmt(q.cachedTotalAudSellIncGst)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
