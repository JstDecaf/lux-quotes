"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ShippingEntry {
  id: number;
  date: string;
  mode: string;
  origin: string;
  destination: string;
  weightKg: number | null;
  volumeCbm: number | null;
  totalCostAud: number;
  costPerKg: number | null;
  costPerCbm: number | null;
  transitDays: number | null;
  forwarder: string | null;
  quoteId: number | null;
  notes: string | null;
}

const MODE_LABELS: Record<string, string> = {
  sea_fcl: "Sea (FCL)",
  sea_lcl: "Sea (LCL)",
  air: "Air",
};

const MODE_COLORS: Record<string, string> = {
  sea_fcl: "bg-blue-100 text-blue-700",
  sea_lcl: "bg-cyan-100 text-cyan-700",
  air: "bg-orange-100 text-orange-700",
};

const fmt = (v: number) => "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDec = (v: number) => "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  mode: "sea_fcl",
  origin: "China",
  destination: "Australia",
  weightKg: "",
  volumeCbm: "",
  totalCostAud: "",
  transitDays: "",
  forwarder: "",
  notes: "",
};

export function ShippingList({ initialEntries }: { initialEntries: ShippingEntry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleAdd = async () => {
    if (!form.totalCostAud || !form.date) return;
    setSaving(true);
    try {
      const res = await fetch("/api/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          weightKg: form.weightKg ? parseFloat(form.weightKg) : null,
          volumeCbm: form.volumeCbm ? parseFloat(form.volumeCbm) : null,
          totalCostAud: parseFloat(form.totalCostAud),
          transitDays: form.transitDays ? parseInt(form.transitDays) : null,
          forwarder: form.forwarder || null,
          notes: form.notes || null,
        }),
      });
      if (res.ok) {
        setAdding(false);
        setForm(emptyForm);
        router.refresh();
        const data = await res.json();
        setEntries([data, ...entries]);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/shipping/${id}`, { method: "DELETE" });
    setEntries(entries.filter((e) => e.id !== id));
    setDeleteId(null);
  };

  // Chart data: cost per CBM over time by mode
  const seaEntries = entries.filter((e) => e.mode.startsWith("sea") && e.costPerCbm).reverse();
  const airEntries = entries.filter((e) => e.mode === "air" && e.costPerCbm).reverse();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-archivo text-2xl font-bold text-[var(--text-primary)]">Shipping Costs</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Track your freight costs from China to Australia</p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="px-4 py-2 bg-lux-black text-white rounded-lg text-sm font-medium hover:bg-lux-navy"
          >
            + Add Entry
          </button>
        )}
      </div>

      {/* Cost per CBM chart */}
      {(seaEntries.length > 1 || airEntries.length > 1) && (
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Cost per CBM Over Time</h3>
          <ShippingChart seaData={seaEntries} airData={airEntries} />
          <div className="flex gap-4 mt-2 text-xs text-[var(--text-muted)]">
            {seaEntries.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-500 inline-block" /> Sea
              </span>
            )}
            {airEntries.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-orange-500 inline-block" /> Air
              </span>
            )}
          </div>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">New Shipping Entry</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Date *</label>
              <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Mode *</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="sea_fcl">Sea (FCL)</option>
                <option value="sea_lcl">Sea (LCL)</option>
                <option value="air">Air</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Total Cost AUD *</label>
              <input type="number" step="0.01" className="w-full border rounded px-3 py-2 text-sm" placeholder="0.00" value={form.totalCostAud} onChange={(e) => setForm({ ...form, totalCostAud: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Volume (CBM)</label>
              <input type="number" step="0.01" className="w-full border rounded px-3 py-2 text-sm" placeholder="0.00" value={form.volumeCbm} onChange={(e) => setForm({ ...form, volumeCbm: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Weight (kg)</label>
              <input type="number" step="0.1" className="w-full border rounded px-3 py-2 text-sm" placeholder="0.0" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Transit Days</label>
              <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="0" value={form.transitDays} onChange={(e) => setForm({ ...form, transitDays: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Forwarder</label>
              <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. DHL, Flexport" value={form.forwarder} onChange={(e) => setForm({ ...form, forwarder: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Notes</label>
              <input type="text" className="w-full border rounded px-3 py-2 text-sm" placeholder="Optional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !form.totalCostAud} className="px-4 py-2 bg-lux-black text-white rounded text-sm hover:bg-lux-navy disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => { setAdding(false); setForm(emptyForm); }} className="px-4 py-2 text-[var(--text-muted)] border rounded text-sm hover:bg-[var(--table-header-bg)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--card-border)] bg-[var(--table-header-bg)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Mode</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Total AUD</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">CBM</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">$/CBM</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Weight</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">$/kg</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Transit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Forwarder</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-[var(--table-header-bg)]">
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{e.date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODE_COLORS[e.mode] || "bg-gray-100"}`}>
                      {MODE_LABELS[e.mode] || e.mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(e.totalCostAud)}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-muted)]">{e.volumeCbm?.toFixed(2) ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-600">{e.costPerCbm ? fmtDec(e.costPerCbm) : "—"}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-muted)]">{e.weightKg?.toFixed(0) ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-muted)]">{e.costPerKg ? fmtDec(e.costPerKg) : "—"}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-muted)]">{e.transitDays ? `${e.transitDays}d` : "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)] text-xs">{e.forwarder ?? "—"}</td>
                  <td className="px-4 py-3">
                    {deleteId === e.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button onClick={() => handleDelete(e.id)} className="text-red-600 font-medium">Yes</button>
                        <button onClick={() => setDeleteId(null)} className="text-[var(--text-faint)]">No</button>
                      </span>
                    ) : (
                      <button onClick={() => setDeleteId(e.id)} className="text-gray-300 hover:text-red-500">×</button>
                    )}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-[var(--text-faint)] text-sm">
                    No shipping entries yet.{" "}
                    <button onClick={() => setAdding(true)} className="text-blue-600 hover:underline">Add your first entry</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Shipping Cost Chart (SVG) ───────────────────────────────────────────────

function ShippingChart({ seaData, airData }: { seaData: ShippingEntry[]; airData: ShippingEntry[] }) {
  const width = 600;
  const height = 120;
  const px = 40;
  const py = 12;

  const allCosts = [
    ...seaData.map((e) => e.costPerCbm!),
    ...airData.map((e) => e.costPerCbm!),
  ];
  if (allCosts.length === 0) return null;

  const minCost = Math.min(...allCosts) * 0.9;
  const maxCost = Math.max(...allCosts) * 1.1;
  const range = maxCost - minCost || 1;

  // Combine all dates for x-axis
  const allDates = [...new Set([...seaData.map((e) => e.date), ...airData.map((e) => e.date)])].sort();
  const dateToX = (date: string) => {
    const idx = allDates.indexOf(date);
    return px + (idx / Math.max(allDates.length - 1, 1)) * (width - px * 2);
  };
  const yScale = (v: number) => py + (1 - (v - minCost) / range) * (height - py * 2);

  const makePath = (data: ShippingEntry[]) =>
    data.map((e, i) => `${i === 0 ? "M" : "L"} ${dateToX(e.date).toFixed(1)} ${yScale(e.costPerCbm!).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {seaData.length > 1 && (
        <>
          <path d={makePath(seaData)} fill="none" stroke="#3B82F6" strokeWidth="2" />
          {seaData.map((e, i) => (
            <circle key={`s${i}`} cx={dateToX(e.date)} cy={yScale(e.costPerCbm!)} r="2" fill="#3B82F6" />
          ))}
        </>
      )}
      {airData.length > 1 && (
        <>
          <path d={makePath(airData)} fill="none" stroke="#F97316" strokeWidth="2" />
          {airData.map((e, i) => (
            <circle key={`a${i}`} cx={dateToX(e.date)} cy={yScale(e.costPerCbm!)} r="2" fill="#F97316" />
          ))}
        </>
      )}
      {/* Axes */}
      <text x={px - 3} y={py + 3} textAnchor="end" className="fill-gray-400" fontSize="8">{fmtDec(maxCost)}</text>
      <text x={px - 3} y={height - py + 3} textAnchor="end" className="fill-gray-400" fontSize="8">{fmtDec(minCost)}</text>
      {allDates.length > 0 && <text x={px} y={height - 1} textAnchor="start" className="fill-gray-400" fontSize="8">{allDates[0].slice(5)}</text>}
      {allDates.length > 1 && <text x={width - px} y={height - 1} textAnchor="end" className="fill-gray-400" fontSize="8">{allDates[allDates.length - 1].slice(5)}</text>}
    </svg>
  );
}
