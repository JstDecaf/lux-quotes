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
  name: string;
  description: string | null;
  status: string;
  quotes: QuoteSummary[];
}

interface Client {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
}

const STATUS_COLORS: Record<string, string> = {
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

export function ClientDetail({ client: initialClient, projects }: { client: Client; projects: Project[] }) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [editing, setEditing] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const saveClient = async () => {
    await fetch(`/api/clients/${client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(client),
    });
    setEditing(false);
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, name: newProjectName.trim() }),
    });
    setNewProjectName("");
    setShowProjectForm(false);
    router.refresh();
  };

  return (
    <div>
      <a href="/clients" className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-block">&larr; Back to Clients</a>

      {/* Client Info Card */}
      <div className="bg-white rounded-lg border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-archivo text-2xl font-bold text-gray-900">
            {editing ? (
              <input
                className="border rounded px-2 py-1 text-2xl font-bold"
                value={client.name}
                onChange={(e) => setClient({ ...client, name: e.target.value })}
              />
            ) : (
              client.name
            )}
          </h1>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={saveClient} className="px-3 py-1.5 bg-[#0D1B2A] text-white rounded text-sm">Save</button>
              <button onClick={() => { setClient(initialClient); setEditing(false); }} className="px-3 py-1.5 text-gray-500 text-sm">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border rounded">Edit</button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Contact:</span>{" "}
            {editing ? (
              <input className="border rounded px-2 py-1 ml-1" value={client.contactName ?? ""} onChange={(e) => setClient({ ...client, contactName: e.target.value || null })} />
            ) : (
              <span className="font-medium">{client.contactName ?? "-"}</span>
            )}
          </div>
          <div>
            <span className="text-gray-500">Email:</span>{" "}
            {editing ? (
              <input className="border rounded px-2 py-1 ml-1" value={client.contactEmail ?? ""} onChange={(e) => setClient({ ...client, contactEmail: e.target.value || null })} />
            ) : (
              <span className="font-medium">{client.contactEmail ?? "-"}</span>
            )}
          </div>
          <div>
            <span className="text-gray-500">Phone:</span>{" "}
            {editing ? (
              <input className="border rounded px-2 py-1 ml-1" value={client.contactPhone ?? ""} onChange={(e) => setClient({ ...client, contactPhone: e.target.value || null })} />
            ) : (
              <span className="font-medium">{client.contactPhone ?? "-"}</span>
            )}
          </div>
          <div>
            <span className="text-gray-500">Address:</span>{" "}
            {editing ? (
              <input className="border rounded px-2 py-1 ml-1" value={client.address ?? ""} onChange={(e) => setClient({ ...client, address: e.target.value || null })} />
            ) : (
              <span className="font-medium">{client.address ?? "-"}</span>
            )}
          </div>
        </div>

        {(editing || client.notes) && (
          <div className="mt-4 pt-4 border-t">
            <span className="text-xs text-gray-500">Notes</span>
            {editing ? (
              <textarea
                className="w-full border rounded px-2 py-1 mt-1 text-sm"
                value={client.notes ?? ""}
                onChange={(e) => setClient({ ...client, notes: e.target.value || null })}
              />
            ) : (
              <p className="text-sm text-gray-600 mt-1">{client.notes}</p>
            )}
          </div>
        )}
      </div>

      {/* Projects */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-archivo text-lg font-bold text-gray-900">Projects</h2>
        <button
          onClick={() => setShowProjectForm(!showProjectForm)}
          className="px-3 py-1.5 bg-[#DB412B] text-white rounded text-sm hover:bg-[#c23823]"
        >
          + Add Project
        </button>
      </div>

      {showProjectForm && (
        <div className="bg-white rounded-lg border p-4 mb-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Project Name</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Main Lobby LED Wall"
              />
            </div>
            <button onClick={createProject} disabled={!newProjectName.trim()} className="px-4 py-2 bg-[#0D1B2A] text-white rounded text-sm disabled:opacity-50">Create</button>
            <button onClick={() => setShowProjectForm(false)} className="px-4 py-2 text-gray-500 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-400">
          No projects yet. Add your first project for this client.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{p.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p.status}</span>
              </div>
              {p.description && <p className="text-sm text-gray-500 mb-3">{p.description}</p>}
              {p.quotes.length > 0 ? (
                <div className="space-y-1">
                  {p.quotes.map((q) => (
                    <a
                      key={q.id}
                      href={`/quotes/${q.id}`}
                      className="flex items-center justify-between text-sm py-1.5 px-3 rounded hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-400">{q.quoteNumber}</span>
                        <span>{q.name}</span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: (STATUS_COLORS[q.status] ?? "#9CA3AF") + "20",
                            color: STATUS_COLORS[q.status] ?? "#9CA3AF",
                          }}
                        >
                          {q.status}
                        </span>
                      </div>
                      <span className="font-medium">{fmt(q.cachedTotalAudSellIncGst)}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No quotes yet</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
