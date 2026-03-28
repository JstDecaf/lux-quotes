"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { calculateLineItem, calculateQuoteTotals, type LineItemInput, type QuoteSettings } from "@/lib/calculations";

const UNITS = ["SQM", "PCS", "LOT", "JOB", "SET"] as const;

interface LineItem {
  id: number;
  quoteId: number;
  sortOrder: number;
  itemName: string;
  description: string | null;
  unit: string;
  qty: number;
  usdUnitPrice: number | null;
  marginOverride: number | null;
  isLocal: boolean;
  audLocalCost: number | null;
  isFree: boolean;
  productVariantId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface QuoteData {
  id: number;
  quoteNumber: string;
  name: string;
  status: string;
  fxRate: number;
  defaultMargin: number;
  gstRate: number;
  notes: string | null;
  screenSize: string | null;
  panelConfig: string | null;
  totalResolution: string | null;
  projectId: number;
  projectName: string | null;
  clientId: number | null;
  clientName: string | null;
  cachedTotalUsd: number | null;
  cachedTotalAudCost: number | null;
  cachedTotalAudSellExGst: number | null;
  cachedTotalAudSellIncGst: number | null;
  cachedTotalGrossProfit: number | null;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "#9CA3AF" },
  { value: "sent", label: "Sent", color: "#3B82F6" },
  { value: "won", label: "Won", color: "#22C55E" },
  { value: "lost", label: "Lost", color: "#EF4444" },
  { value: "expired", label: "Expired", color: "#F59E0B" },
  { value: "converted_to_pi", label: "Converted to PI", color: "#8B5CF6" },
];

function fmt(val: number): string {
  return "$" + val.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: number): string {
  return (val * 100).toFixed(1) + "%";
}

export function QuoteEditor({
  initialQuote,
  initialItems,
}: {
  initialQuote: QuoteData;
  initialItems: LineItem[];
}) {
  const [quote, setQuote] = useState(initialQuote);
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settings: QuoteSettings = {
    fxRate: quote.fxRate,
    defaultMargin: quote.defaultMargin,
    gstRate: quote.gstRate,
  };

  // Calculate totals client-side
  const itemInputs: LineItemInput[] = items.map((item) => ({
    qty: item.qty,
    usdUnitPrice: item.usdUnitPrice ?? 0,
    marginOverride: item.marginOverride,
    isLocal: item.isLocal,
    audLocalCost: item.audLocalCost ?? 0,
    isFree: item.isFree,
  }));

  const totals = calculateQuoteTotals(itemInputs, settings);

  const calculatedItems = items.map((item) => {
    const input: LineItemInput = {
      qty: item.qty,
      usdUnitPrice: item.usdUnitPrice ?? 0,
      marginOverride: item.marginOverride,
      isLocal: item.isLocal,
      audLocalCost: item.audLocalCost ?? 0,
      isFree: item.isFree,
    };
    return calculateLineItem(input, settings);
  });

  // Debounced save for line items
  const saveItems = useCallback(
    (updatedItems: LineItem[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch(`/api/quotes/${quote.id}/line-items`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedItems),
          });
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [quote.id]
  );

  // Save quote settings
  const saveQuoteSettings = useCallback(
    (updates: Partial<QuoteData>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch(`/api/quotes/${quote.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [quote.id]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updateQuoteField = (field: string, value: unknown) => {
    const updated = { ...quote, [field]: value };
    setQuote(updated as QuoteData);
    saveQuoteSettings({ [field]: value });
  };

  const updateItem = (index: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
    saveItems(updated);
  };

  const addItem = async (preset?: { itemName: string; isLocal: boolean; unit: string }) => {
    const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) : 0;
    const body = {
      itemName: preset?.itemName ?? "New Item",
      isLocal: preset?.isLocal ?? false,
      unit: preset?.unit ?? "PCS",
      sortOrder: maxOrder + 1,
      qty: 1,
      usdUnitPrice: 0,
      audLocalCost: 0,
    };

    const res = await fetch(`/api/quotes/${quote.id}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const item = await res.json();
    setItems([...items, item]);
  };

  const deleteItem = async (index: number) => {
    const item = items[index];
    await fetch(`/api/quotes/${quote.id}/line-items/${item.id}`, { method: "DELETE" });
    setItems(items.filter((_, i) => i !== index));
  };

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === quote.status) ?? STATUS_OPTIONS[0];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <a href="/quotes" className="text-gray-500 hover:text-gray-700 text-sm">&larr; Back to Quotes</a>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400">Saving...</span>}
        </div>
      </div>

      {/* Quote Title Row */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm font-mono text-gray-500">{quote.quoteNumber}</span>
        <input
          className="text-2xl font-archivo font-bold text-[#0D1B2A] bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#DB412B] focus:outline-none px-1 flex-1"
          value={quote.name}
          onChange={(e) => updateQuoteField("name", e.target.value)}
        />
        <select
          className="text-sm px-3 py-1.5 rounded-full font-medium border-0 cursor-pointer"
          style={{ backgroundColor: statusInfo.color + "20", color: statusInfo.color }}
          value={quote.status}
          onChange={(e) => updateQuoteField("status", e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Client & Project links */}
      <div className="flex gap-4 mb-6 text-sm text-gray-600">
        {quote.clientName && (
          <a href={`/clients/${quote.clientId}`} className="hover:text-[#DB412B]">
            Client: <span className="font-medium">{quote.clientName}</span>
          </a>
        )}
        {quote.projectName && (
          <span>
            Project: <span className="font-medium">{quote.projectName}</span>
          </span>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg border p-5 mb-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">FX Rate (USD/AUD)</label>
            <input
              type="number"
              step="0.001"
              className="w-full border rounded px-3 py-2 text-sm"
              value={quote.fxRate}
              onChange={(e) => updateQuoteField("fxRate", parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Default Margin %</label>
            <input
              type="number"
              step="0.1"
              className="w-full border rounded px-3 py-2 text-sm"
              value={(quote.defaultMargin * 100).toFixed(1)}
              onChange={(e) => updateQuoteField("defaultMargin", (parseFloat(e.target.value) || 0) / 100)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">GST Rate %</label>
            <input
              type="number"
              step="0.1"
              className="w-full border rounded px-3 py-2 text-sm"
              value={(quote.gstRate * 100).toFixed(1)}
              onChange={(e) => updateQuoteField("gstRate", (parseFloat(e.target.value) || 0) / 100)}
            />
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-500">Total USD</p>
            <p className="text-lg font-bold">US${totals.totalUsd.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-500">Total AUD Cost</p>
            <p className="text-lg font-bold">{fmt(totals.totalAudCost)}</p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-500">Total AUD Sell ex-GST</p>
            <p className="text-lg font-bold">{fmt(totals.totalAudSellExGst)}</p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-500">Total GST</p>
            <p className="text-lg font-bold">{fmt(totals.totalGst)}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-500">Total AUD inc-GST</p>
            <p className="text-xl font-bold text-[#0D1B2A]">{fmt(totals.totalAudSellIncGst)}</p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-500">Gross Profit</p>
            <p className="text-xl font-bold text-green-600">{fmt(totals.totalGrossProfit)}</p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-500">Overall Margin</p>
            <p className="text-xl font-bold">{fmtPct(totals.overallMargin)}</p>
          </div>
        </div>

        {/* Screen specs */}
        {(quote.screenSize || quote.panelConfig || quote.totalResolution) && (
          <div className="mt-4 pt-4 border-t flex gap-6 text-sm text-gray-600">
            {quote.screenSize && <span>Screen: {quote.screenSize}</span>}
            {quote.panelConfig && <span>Panels: {quote.panelConfig}</span>}
            {quote.totalResolution && <span>Resolution: {quote.totalResolution}</span>}
          </div>
        )}

        {/* Notes */}
        <div className="mt-4 pt-4 border-t">
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm min-h-[60px]"
            value={quote.notes ?? ""}
            onChange={(e) => updateQuoteField("notes", e.target.value)}
            placeholder="Add notes..."
          />
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0D1B2A] text-white text-xs">
                <th className="px-2 py-2 text-left w-8">#</th>
                <th className="px-2 py-2 text-left min-w-[180px]">Item Name</th>
                <th className="px-2 py-2 text-left w-16">Unit</th>
                <th className="px-2 py-2 text-right w-16">Qty</th>
                <th className="px-2 py-2 text-right w-24">USD Unit</th>
                <th className="px-2 py-2 text-right w-24 bg-white/5">USD Sub</th>
                <th className="px-2 py-2 text-right w-24 bg-white/5">AUD Cost</th>
                <th className="px-2 py-2 text-right w-20">Margin%</th>
                <th className="px-2 py-2 text-right w-24 bg-white/5">Sell exGST</th>
                <th className="px-2 py-2 text-right w-20 bg-white/5">GST</th>
                <th className="px-2 py-2 text-right w-24 bg-white/5">Sell incGST</th>
                <th className="px-2 py-2 text-right w-24 bg-white/5">Profit</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const calc = calculatedItems[idx];
                const isLocal = item.isLocal;
                const isFree = item.isFree;
                const rowBg = isFree
                  ? "bg-gray-100"
                  : isLocal
                  ? "bg-amber-50"
                  : "bg-white";

                return (
                  <tr key={item.id} className={`${rowBg} border-b border-gray-100 hover:bg-gray-50/50`}>
                    <td className="px-2 py-1 text-gray-400 text-xs">{item.sortOrder}</td>
                    <td className="px-2 py-1">
                      <input
                        className={`w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 ${isFree ? "line-through text-gray-400" : ""}`}
                        value={item.itemName}
                        onChange={(e) => updateItem(idx, "itemName", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <select
                        className="bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 text-xs w-full"
                        value={item.unit}
                        onChange={(e) => updateItem(idx, "unit", e.target.value)}
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="1"
                        className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 text-right"
                        value={item.qty}
                        onChange={(e) => updateItem(idx, "qty", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        className={`w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 text-right ${isLocal ? "text-gray-300 cursor-not-allowed" : ""}`}
                        value={item.usdUnitPrice ?? 0}
                        disabled={isLocal}
                        onChange={(e) => updateItem(idx, "usdUnitPrice", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className={`px-2 py-1 text-right bg-gray-50 text-gray-600 ${isFree ? "line-through" : ""}`}>
                      {fmt(calc.usdSubtotal)}
                    </td>
                    <td className="px-2 py-1 text-right bg-gray-50">
                      {isLocal ? (
                        <input
                          type="number"
                          step="0.01"
                          className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 text-right"
                          value={item.audLocalCost ?? 0}
                          onChange={(e) => updateItem(idx, "audLocalCost", parseFloat(e.target.value) || 0)}
                        />
                      ) : (
                        <span className={`text-gray-600 ${isFree ? "line-through" : ""}`}>{fmt(calc.audCost)}</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.1"
                        className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 text-right"
                        placeholder={fmtPct(settings.defaultMargin)}
                        value={item.marginOverride != null ? (item.marginOverride * 100).toFixed(1) : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateItem(idx, "marginOverride", v === "" ? null : (parseFloat(v) || 0) / 100);
                        }}
                      />
                    </td>
                    <td className={`px-2 py-1 text-right bg-gray-50 text-gray-600 ${isFree ? "line-through" : ""}`}>
                      {fmt(calc.audSellExGst)}
                    </td>
                    <td className={`px-2 py-1 text-right bg-gray-50 text-gray-600 ${isFree ? "line-through" : ""}`}>
                      {fmt(calc.gst)}
                    </td>
                    <td className={`px-2 py-1 text-right bg-gray-50 text-gray-600 ${isFree ? "line-through" : ""}`}>
                      {fmt(calc.audSellIncGst)}
                    </td>
                    <td className={`px-2 py-1 text-right bg-gray-50 text-gray-600 ${isFree ? "line-through" : ""}`}>
                      {fmt(calc.grossProfit)}
                    </td>
                    <td className="px-2 py-1">
                      <button
                        onClick={() => deleteItem(idx)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete item"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr className="border-t-2 border-[#0D1B2A] font-bold bg-gray-50">
                <td className="px-2 py-2" colSpan={5}>
                  TOTALS
                </td>
                <td className="px-2 py-2 text-right">{fmt(totals.totalUsd)}</td>
                <td className="px-2 py-2 text-right">{fmt(totals.totalAudCost)}</td>
                <td className="px-2 py-2 text-right">{fmtPct(totals.overallMargin)}</td>
                <td className="px-2 py-2 text-right">{fmt(totals.totalAudSellExGst)}</td>
                <td className="px-2 py-2 text-right">{fmt(totals.totalGst)}</td>
                <td className="px-2 py-2 text-right">{fmt(totals.totalAudSellIncGst)}</td>
                <td className="px-2 py-2 text-right text-green-600">{fmt(totals.totalGrossProfit)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 p-3 border-t bg-gray-50">
          <button
            onClick={() => addItem()}
            className="px-3 py-1.5 text-sm bg-[#0D1B2A] text-white rounded hover:bg-[#1a2d42] transition-colors"
          >
            + Add Item
          </button>
          <button
            onClick={() => addItem({ itemName: "Freight", isLocal: true, unit: "JOB" })}
            className="px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors"
          >
            + Add Freight
          </button>
          <button
            onClick={() => addItem({ itemName: "Frame Build & Install", isLocal: true, unit: "JOB" })}
            className="px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors"
          >
            + Add Frame Build
          </button>

          {/* Toggle controls for selected items */}
          <div className="ml-auto flex gap-2 text-xs text-gray-500">
            <label className="flex items-center gap-1">
              <span>Tip: Click margins to override per-item</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
