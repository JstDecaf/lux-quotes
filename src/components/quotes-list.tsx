"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft", color: "#9CA3AF" },
  { value: "sent", label: "Sent", color: "#3B82F6" },
  { value: "won", label: "Won", color: "#22C55E" },
  { value: "lost", label: "Lost", color: "#EF4444" },
  { value: "expired", label: "Expired", color: "#F59E0B" },
  { value: "converted_to_pi", label: "Converted to PI", color: "#8B5CF6" },
];

function fmt(val: number | null): string {
  if (val == null) return "$0.00";
  return "$" + val.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Quote {
  id: number;
  quoteNumber: string;
  name: string;
  status: string;
  cachedTotalAudSellIncGst: number | null;
  cachedTotalGrossProfit: number | null;
  createdAt: string;
  clientName: string | null;
  projectName: string | null;
  projectId: number;
}

interface Project {
  id: number;
  name: string;
  clientName: string | null;
}

export function QuotesList({ quotes, projects }: { quotes: Quote[]; projects: Project[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProjectId, setNewProjectId] = useState<number | "">(projects[0]?.id ?? "");

  const filtered = statusFilter === "all" ? quotes : quotes.filter((q) => q.status === statusFilter);

  const createQuote = async () => {
    if (!newName.trim() || !newProjectId) return;
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: newProjectId, name: newName.trim() }),
    });
    const quote = await res.json();
    router.push(`/quotes/${quote.id}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="font-archivo text-xl sm:text-2xl font-bold text-gray-900">Quotes</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 sm:px-4 py-2 bg-[#DB412B] text-white rounded-lg hover:bg-[#c23823] transition-colors text-sm font-medium"
        >
          + New Quote
        </button>
      </div>

      {/* New Quote Form */}
      {showForm && (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <h2 className="font-medium text-sm mb-3">Create New Quote</h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Quote Name</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. LED Wall - Main Foyer"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Project</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={newProjectId}
                onChange={(e) => setNewProjectId(parseInt(e.target.value) || "")}
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.clientName ? `${p.clientName} - ` : ""}{p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={createQuote}
                disabled={!newName.trim() || !newProjectId}
                className="px-4 py-2 bg-[#0D1B2A] text-white rounded text-sm hover:bg-[#1a2d42] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              statusFilter === s.value
                ? "bg-[#0D1B2A] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
              <th className="px-4 py-3 text-left">Quote #</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Project</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Total inc-GST</th>
              <th className="px-4 py-3 text-right">Profit</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No quotes found. Create your first quote to get started.
                </td>
              </tr>
            ) : (
              filtered.map((q) => {
                const statusInfo = STATUS_OPTIONS.find((s) => s.value === q.status);
                return (
                  <tr
                    key={q.id}
                    onClick={() => router.push(`/quotes/${q.id}`)}
                    className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{q.quoteNumber}</td>
                    <td className="px-4 py-3">{q.clientName ?? "-"}</td>
                    <td className="px-4 py-3">{q.projectName ?? "-"}</td>
                    <td className="px-4 py-3 font-medium">{q.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: (statusInfo?.color ?? "#9CA3AF") + "20",
                          color: statusInfo?.color ?? "#9CA3AF",
                        }}
                      >
                        {statusInfo?.label ?? q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(q.cachedTotalAudSellIncGst)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmt(q.cachedTotalGrossProfit)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{q.createdAt?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete quote "${q.quoteNumber} - ${q.name}"?\n\nThis will permanently remove the quote and all its line items.`)) {
                            fetch(`/api/quotes/${q.id}`, { method: "DELETE" }).then(() => router.refresh());
                          }
                        }}
                        className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete quote"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border p-6 text-center text-gray-400 text-sm">
            No quotes found. Create your first quote to get started.
          </div>
        ) : (
          filtered.map((q) => {
            const statusInfo = STATUS_OPTIONS.find((s) => s.value === q.status);
            return (
              <div
                key={q.id}
                onClick={() => router.push(`/quotes/${q.id}`)}
                className="bg-white rounded-lg border p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{q.name}</p>
                    <p className="text-xs text-gray-500">{q.clientName ?? "No client"} · {q.projectName ?? "No project"}</p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium ml-2 flex-shrink-0"
                    style={{
                      backgroundColor: (statusInfo?.color ?? "#9CA3AF") + "20",
                      color: statusInfo?.color ?? "#9CA3AF",
                    }}
                  >
                    {statusInfo?.label ?? q.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-gray-400">{q.quoteNumber}</span>
                  <div className="text-right">
                    <span className="font-bold">{fmt(q.cachedTotalAudSellIncGst)}</span>
                    <span className="text-green-600 text-xs ml-2">+{fmt(q.cachedTotalGrossProfit)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
