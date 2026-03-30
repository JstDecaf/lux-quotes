"use client";

import { useState, useEffect, useCallback } from "react";
import { NumericInput } from "@/components/numeric-input";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  id: number;
  itemName: string;
  description: string | null;
  unit: string;
  qty: number;
  usdUnitPrice: number | null;
  isFree: boolean;
  productVariantId: number | null;
}

interface FreightRow {
  lineItemId: number;
  itemName: string;
  unit: string;
  qty: number;
  unitWeightKg: number;
  unitVolumeCbm: number;
}

interface FreightCalculatorProps {
  quoteId: number;
  quoteName: string;
  fxRate: number;
  lineItems: LineItem[];
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWoodenCase(name: string) {
  const n = name.toLowerCase();
  return n.includes("wooden") || n.includes("wood case") || n.includes("packing case") || n.includes("export pack");
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number, prefix = "US$") {
  return `${prefix}${fmt(n)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FreightCalculator({ quoteName, fxRate, lineItems, onClose }: FreightCalculatorProps) {
  const [mode, setMode] = useState<"air" | "sea">("sea");
  const [airRatePerKg, setAirRatePerKg] = useState(6.5);      // USD/kg
  const [seaRatePerCbm, setSeaRatePerCbm] = useState(280);    // USD/CBM (revenue tonne)
  const [volFactor, setVolFactor] = useState(167);             // kg/CBM for air volumetric
  const [rows, setRows] = useState<FreightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");

  // ── Load variant weights on mount ──
  const initRows = useCallback(async () => {
    // Build initial rows from line items (skip zero-qty and free-included items with $0)
    const eligible = lineItems.filter((item) => item.qty > 0);

    // Fetch variant weights for items that have a variant linked
    const variantIds = eligible
      .map((i) => i.productVariantId)
      .filter((id): id is number => id !== null && id > 0);

    let weightMap: Record<number, { weightKg: number; rawWeight: string }> = {};
    if (variantIds.length > 0) {
      try {
        const res = await fetch(`/api/variants/weights?ids=${variantIds.join(",")}`);
        if (res.ok) weightMap = await res.json();
      } catch {
        // silently fail — weights default to 0
      }
    }

    const initialRows: FreightRow[] = eligible.map((item) => {
      const variantWeight = item.productVariantId ? weightMap[item.productVariantId] : null;
      const unitWeightKg = variantWeight?.weightKg ?? 0;
      // Wooden cases → 1 CBM per unit by default; everything else 0
      const unitVolumeCbm = isWoodenCase(item.itemName) ? 1 : 0;

      return {
        lineItemId: item.id,
        itemName: item.itemName,
        unit: item.unit,
        qty: item.qty,
        unitWeightKg,
        unitVolumeCbm,
      };
    });

    setRows(initialRows);
    setLoading(false);
  }, [lineItems]);

  useEffect(() => { initRows(); }, [initRows]);

  const updateRow = (idx: number, field: keyof FreightRow, value: number) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  // ── Totals ────────────────────────────────────────────────────────────────
  const grossWeightKg = rows.reduce((sum, r) => sum + r.qty * r.unitWeightKg, 0);
  const totalVolumeCbm = rows.reduce((sum, r) => sum + r.qty * r.unitVolumeCbm, 0);

  const airVolumetricKg = totalVolumeCbm * volFactor;
  const airChargeableKg = Math.max(grossWeightKg, airVolumetricKg);
  const airFreightUsd = airChargeableKg * airRatePerKg;

  // Sea: revenue tonne = max(gross weight in tonnes, CBM)
  const seaRevenueTonnes = Math.max(grossWeightKg / 1000, totalVolumeCbm);
  const seaFreightUsd = seaRevenueTonnes * seaRatePerCbm;

  const freightUsd = mode === "air" ? airFreightUsd : seaFreightUsd;
  const freightAud = freightUsd / fxRate;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-archivo text-lg font-bold text-gray-900">Freight Calculator</h2>
            <p className="text-sm text-gray-500">{quoteName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Mode + Rates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mode selector */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Freight Mode</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("sea")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                    mode === "sea"
                      ? "bg-[#0D1B2A] text-white border-[#0D1B2A]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  🚢 Sea Freight
                </button>
                <button
                  onClick={() => setMode("air")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                    mode === "air"
                      ? "bg-[#0D1B2A] text-white border-[#0D1B2A]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  ✈ Air Freight
                </button>
              </div>
            </div>

            {/* Rates */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Rates</p>
              {mode === "sea" ? (
                <div className="space-y-2">
                  <label className="block text-xs text-gray-500">
                    Sea rate (USD / revenue tonne)
                    <NumericInput
                      value={seaRatePerCbm}
                      onChange={setSeaRatePerCbm}
                      step="10"
                      className="mt-1 w-full border rounded px-3 py-2 text-sm bg-white"
                    />
                  </label>
                  <p className="text-xs text-gray-400">Revenue tonne = max(gross weight ÷ 1000, CBM)</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs text-gray-500">
                    Air rate (USD / chargeable kg)
                    <NumericInput
                      value={airRatePerKg}
                      onChange={setAirRatePerKg}
                      step="0.5"
                      className="mt-1 w-full border rounded px-3 py-2 text-sm bg-white"
                    />
                  </label>
                  <label className="block text-xs text-gray-500">
                    Volumetric factor (kg / CBM)
                    <NumericInput
                      value={volFactor}
                      onChange={setVolFactor}
                      step="1"
                      className="mt-1 w-full border rounded px-3 py-2 text-sm bg-white"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Line items table */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Items</p>
            {loading ? (
              <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Item</th>
                      <th className="text-right px-3 py-2 font-medium">Qty</th>
                      <th className="text-right px-3 py-2 font-medium w-32">Unit Weight (kg)</th>
                      <th className="text-right px-3 py-2 font-medium w-28">Total (kg)</th>
                      <th className="text-right px-3 py-2 font-medium w-32">Unit Vol (CBM)</th>
                      <th className="text-right px-3 py-2 font-medium w-28">Total (CBM)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, idx) => {
                      const totalKg = row.qty * row.unitWeightKg;
                      const totalCbm = row.qty * row.unitVolumeCbm;
                      return (
                        <tr key={row.lineItemId} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800">
                            <span className="font-medium">{row.itemName}</span>
                            <span className="text-gray-400 ml-1">× {row.qty} {row.unit}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{row.qty}</td>
                          <td className="px-3 py-2">
                            <NumericInput
                              value={row.unitWeightKg}
                              onChange={(v) => updateRow(idx, "unitWeightKg", v)}
                              step="0.1"
                              className="w-full text-right border rounded px-2 py-1 text-sm bg-white"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 font-medium">
                            {totalKg > 0 ? fmt(totalKg, 1) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <NumericInput
                              value={row.unitVolumeCbm}
                              onChange={(v) => updateRow(idx, "unitVolumeCbm", v)}
                              step="0.1"
                              className="w-full text-right border rounded px-2 py-1 text-sm bg-white"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 font-medium">
                            {totalCbm > 0 ? fmt(totalCbm, 2) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 text-sm font-semibold border-t-2 border-gray-200">
                    <tr>
                      <td className="px-3 py-2 text-gray-700" colSpan={2}>Totals</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right text-gray-900">{fmt(grossWeightKg, 1)} kg</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right text-gray-900">{fmt(totalVolumeCbm, 2)} CBM</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Calculation breakdown */}
          {!loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                  {mode === "air" ? "Air Calculation" : "Sea Calculation"}
                </p>
                {mode === "air" ? (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Gross weight</span>
                      <span>{fmt(grossWeightKg, 1)} kg</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Volume ({fmt(totalVolumeCbm, 2)} CBM × {volFactor})</span>
                      <span>{fmt(airVolumetricKg, 1)} kg</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-800 border-t pt-2">
                      <span>Chargeable weight {airVolumetricKg > grossWeightKg ? "(vol)" : "(wt)"}</span>
                      <span>{fmt(airChargeableKg, 1)} kg</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>× US${airRatePerKg}/kg</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Gross weight</span>
                      <span>{fmt(grossWeightKg / 1000, 3)} t</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Volume</span>
                      <span>{fmt(totalVolumeCbm, 2)} CBM</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-800 border-t pt-2">
                      <span>Revenue tonnes {grossWeightKg / 1000 > totalVolumeCbm ? "(wt)" : "(vol)"}</span>
                      <span>{fmt(seaRevenueTonnes, 3)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>× US${seaRatePerCbm}/revenue tonne</span>
                    </div>
                  </>
                )}
              </div>

              {/* Result */}
              <div className="bg-[#0D1B2A] rounded-lg p-4 text-white space-y-3">
                <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Estimated Freight Cost</p>
                <div>
                  <p className="text-3xl font-bold">{fmtCurrency(freightUsd)}</p>
                  <p className="text-sm text-blue-200 mt-1">≈ {fmtCurrency(freightAud, "A$")} at {fxRate} FX rate</p>
                </div>
                <div className="border-t border-white/20 pt-3 text-xs text-blue-200 space-y-1">
                  <p>{mode === "air" ? "✈ Air freight" : "🚢 Sea freight (LCL)"}</p>
                  <p>EXW Shenzhen — rates are indicative only</p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="Freight notes, carrier, ETD…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
