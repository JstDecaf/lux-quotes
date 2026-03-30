"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { calculateLineItem, calculateQuoteTotals, type LineItemInput, type QuoteSettings } from "@/lib/calculations";
import { NumericInput } from "@/components/numeric-input";
import { FreightCalculator } from "@/components/freight-calculator";
import { ProductPicker } from "@/components/product-picker";

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
  resellerMarginOverride: number | null;
  isLocal: boolean;
  audLocalCost: number | null;
  isFree: boolean;
  productId: number | null;
  productVariantId: number | null;
  productName: string | null;
  variantName: string | null;
  pixelPitch: string | null;
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
  defaultResellerMargin: number;
  gstRate: number;
  depositPct: number;
  secondTranchePct: number;
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
    defaultResellerMargin: quote.defaultResellerMargin,
    gstRate: quote.gstRate,
    depositPct: quote.depositPct,
    secondTranchePct: quote.secondTranchePct,
  };

  const itemInputs: LineItemInput[] = items.map((item) => ({
    qty: item.qty,
    usdUnitPrice: item.usdUnitPrice ?? 0,
    marginOverride: item.marginOverride,
    resellerMarginOverride: item.resellerMarginOverride,
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
      resellerMarginOverride: item.resellerMarginOverride,
      isLocal: item.isLocal,
      audLocalCost: item.audLocalCost ?? 0,
      isFree: item.isFree,
    };
    return calculateLineItem(input, settings);
  });

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
    const isLocal = preset?.isLocal ?? false;
    const body = {
      itemName: preset?.itemName ?? "New Item",
      isLocal,
      // Local items (freight, installation etc) default to 0% margin — pass-through at cost
      // USD items default to null (uses quote default margin)
      marginOverride: isLocal ? 0 : null,
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

  const unlinkProduct = async (idx: number) => {
    const item = items[idx];
    await fetch(`/api/quotes/${quote.id}/line-items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ ...item, productId: null, productVariantId: null }]),
    });
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, productId: null, productVariantId: null, productName: null, variantName: null, pixelPitch: null } : it));
  };

  const handleProductSelected = async (selection: { productId: number; productName: string; variantId: number | null; variantName: string | null; pixelPitch: string | null; weight: string | null; pricePerSqmUsd: number | null }) => {
    if (!showProductPicker) return;

    if (showProductPicker.mode === 'add') {
      const itemName = selection.variantName || selection.productName;
      const unit = selection.pixelPitch ? 'SQM' : 'PCS';
      const usdUnitPrice = selection.pricePerSqmUsd ?? 0;

      const res = await fetch(`/api/quotes/${quote.id}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName,
          unit,
          qty: 1,
          usdUnitPrice,
          productId: selection.productId,
          productVariantId: selection.variantId,
          sortOrder: items.length,
        }),
      });
      const newItem = await res.json();
      setItems(prev => [...prev, { ...newItem, productName: selection.productName, variantName: selection.variantName, pixelPitch: selection.pixelPitch }]);
    } else if (showProductPicker.mode === 'link' && showProductPicker.itemIdx !== null) {
      const idx = showProductPicker.itemIdx;
      const item = items[idx];
      await fetch(`/api/quotes/${quote.id}/line-items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ ...item, productId: selection.productId, productVariantId: selection.variantId }]),
      });
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, productId: selection.productId, productVariantId: selection.variantId, productName: selection.productName, variantName: selection.variantName, pixelPitch: selection.pixelPitch } : it));
    }

    setShowProductPicker(null);
  };

  const [exporting, setExporting] = useState<string | null>(null);
  const [showFreight, setShowFreight] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState<{ mode: 'link' | 'add', itemIdx: number | null } | null>(null);

  const downloadPriceSheet = async () => {
    setExporting("price-sheet");
    try {
      const res = await fetch(`/api/quotes/${quote.id}/export/price-sheet`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LUX-PriceSheet-${quote.quoteNumber}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Price sheet export error:", err);
      alert("Failed to export price sheet. Check console for details.");
    } finally {
      setExporting(null);
    }
  };

  const downloadProposal = async () => {
    setExporting("proposal");
    try {
      const res = await fetch(`/api/quotes/${quote.id}/export/proposal`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LUX-Proposal-${quote.quoteNumber}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Proposal export error:", err);
      alert("Failed to export proposal. Check console for details.");
    } finally {
      setExporting(null);
    }
  };

  const deleteQuote = async () => {
    const reason = prompt("Why are you deleting this quote? (e.g. replaced by another product, no longer required)\n\nType DELETE to confirm:");
    if (reason !== "DELETE") return;
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      window.location.href = "/quotes";
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete quote.");
    }
  };

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === quote.status) ?? STATUS_OPTIONS[0];

  const balancePct = 1 - quote.depositPct - quote.secondTranchePct;

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
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
        <span className="text-sm font-mono text-gray-500">{quote.quoteNumber}</span>
        <input
          className="text-xl sm:text-2xl font-archivo font-bold text-[#0D1B2A] bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#DB412B] focus:outline-none px-1 flex-1 min-w-0"
          value={quote.name}
          onChange={(e) => updateQuoteField("name", e.target.value)}
        />
        <select
          className="text-sm px-3 py-1.5 rounded-full font-medium border-0 cursor-pointer self-start sm:self-auto"
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
      <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6 text-sm text-gray-600">
        {quote.clientName && (
          <a href={`/clients/${quote.clientId}`} className="hover:text-[#DB412B]">
            Client: <span className="font-medium">{quote.clientName}</span>
          </a>
        )}
        {quote.projectName && (
          <a href={`/projects/${quote.projectId}`} className="hover:text-[#DB412B]">
            Project: <span className="font-medium">{quote.projectName}</span>
          </a>
        )}
      </div>

      {/* Settings Card */}
      <div className="bg-white rounded-lg border p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quote Settings</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">FX Rate (USD/AUD)</label>
            <NumericInput
              step="0.001"
              className="w-full border rounded px-3 py-2 text-sm"
              value={quote.fxRate}
              onChange={(v) => updateQuoteField("fxRate", v)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">LUX Margin %</label>
            <NumericInput
              step="1"
              className="w-full border rounded px-3 py-2 text-sm"
              value={quote.defaultMargin}
              displayMultiplier={100}
              onChange={(v) => updateQuoteField("defaultMargin", v)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Reseller Margin %</label>
            <NumericInput
              step="1"
              className="w-full border rounded px-3 py-2 text-sm"
              value={quote.defaultResellerMargin}
              displayMultiplier={100}
              onChange={(v) => updateQuoteField("defaultResellerMargin", v)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">GST Rate %</label>
            <NumericInput
              step="1"
              className="w-full border rounded px-3 py-2 text-sm"
              value={quote.gstRate}
              displayMultiplier={100}
              onChange={(v) => updateQuoteField("gstRate", v)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Deposit %</label>
            <NumericInput
              step="1"
              className="w-full border rounded px-3 py-2 text-sm"
              value={quote.depositPct}
              displayMultiplier={100}
              onChange={(v) => updateQuoteField("depositPct", v)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">2nd Tranche %</label>
            <NumericInput
              step="1"
              className="w-full border rounded px-3 py-2 text-sm"
              value={quote.secondTranchePct}
              displayMultiplier={100}
              onChange={(v) => updateQuoteField("secondTranchePct", v)}
            />
          </div>
        </div>
      </div>

      {/* Three Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* LUX Pricing Card */}
        <div className="bg-white rounded-lg border border-l-4 border-l-gray-400 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">LUX Pricing</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total USD</span>
              <span className="font-medium">US${totals.totalUsd.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">AUD Cost</span>
              <span className="font-medium">{fmt(totals.totalAudCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sell ex-GST</span>
              <span className="font-medium">{fmt(totals.totalAudSellExGst)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">GST</span>
              <span className="font-medium">{fmt(totals.totalGst)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sell inc-GST</span>
              <span className="font-bold">{fmt(totals.totalAudSellIncGst)}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-green-700">Gross Profit</span>
                <span className="text-lg font-bold text-green-600">{fmt(totals.totalGrossProfit)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">Overall Margin</span>
                <span className="font-semibold">{fmtPct(totals.overallMargin)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reseller Pricing Card */}
        <div className="bg-white rounded-lg border border-l-4 border-l-blue-400 p-4">
          <h3 className="text-sm font-semibold text-blue-700 mb-3">Reseller Pricing</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sell ex-GST</span>
              <span className="font-medium text-blue-700">{fmt(totals.totalResellerSellExGst)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">GST</span>
              <span className="font-medium text-blue-700">{fmt(totals.totalResellerGst)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sell inc-GST</span>
              <span className="font-bold text-blue-800">{fmt(totals.totalResellerSellIncGst)}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-blue-700">Reseller Profit</span>
                <span className="text-lg font-bold text-blue-600">{fmt(totals.totalResellerProfit)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Schedule Card */}
        <div className="bg-white rounded-lg border border-l-4 border-l-purple-400 p-4">
          <h3 className="text-sm font-semibold text-purple-700 mb-3">Payment Schedule</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Deposit ({(quote.depositPct * 100).toFixed(0)}%)</span>
              <span className="font-medium text-purple-700">{fmt(totals.depositAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">2nd Payment ({(quote.secondTranchePct * 100).toFixed(0)}%)</span>
              <span className="font-medium text-purple-700">{fmt(totals.secondTrancheAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Balance ({(balancePct * 100).toFixed(0)}%)</span>
              <span className="font-medium text-purple-700">{fmt(totals.balanceAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Screen Specs */}
      {(quote.screenSize || quote.panelConfig || quote.totalResolution) && (
        <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-3 sm:gap-6 text-sm text-gray-600">
          {quote.screenSize && <span><strong>Screen:</strong> {quote.screenSize}</span>}
          {quote.panelConfig && <span><strong>Panels:</strong> {quote.panelConfig}</span>}
          {quote.totalResolution && <span><strong>Resolution:</strong> {quote.totalResolution}</span>}
        </div>
      )}

      {/* Notes - Collapsible */}
      <details className="bg-white rounded-lg border mb-6 group">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 select-none flex items-center justify-between">
          <span>Notes</span>
          <span className="text-gray-400 text-xs group-open:rotate-180 transition-transform">&#9660;</span>
        </summary>
        <div className="px-4 pb-4">
          <textarea
            className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
            value={quote.notes ?? ""}
            onChange={(e) => updateQuoteField("notes", e.target.value)}
            placeholder="Add notes..."
          />
        </div>
      </details>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <button
          onClick={downloadPriceSheet}
          disabled={exporting !== null}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {exporting === "price-sheet" ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>📊</span>
          )}
          {exporting === "price-sheet" ? "Generating..." : "Export Reseller Price Sheet"}
        </button>
        <button
          onClick={downloadProposal}
          disabled={exporting !== null}
          className="px-4 py-2 bg-[#0D1B2A] text-white rounded-lg hover:bg-[#1a2d42] text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {exporting === "proposal" ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>📑</span>
          )}
          {exporting === "proposal" ? "Generating..." : "Export Client Proposal"}
        </button>
        <button
          onClick={() => setShowFreight(true)}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <span>🚢</span>
          Freight Calculator
        </button>
        <div className="flex-1" />
        <button
          onClick={deleteQuote}
          className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-400 text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <span>🗑️</span>
          Delete Quote
        </button>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0D1B2A] text-white text-xs">
                <th className="px-2 py-2 text-left w-8">#</th>
                <th className="px-2 py-2 text-left min-w-[180px] sticky left-0 bg-[#0D1B2A] z-10">Item Name</th>
                <th className="px-2 py-2 text-left w-16">Unit</th>
                <th className="px-2 py-2 text-right w-16">Qty</th>
                <th className="px-2 py-2 text-right w-24">USD Unit</th>
                <th className="px-2 py-2 text-right w-24 bg-white/5">USD Sub</th>
                <th className="px-2 py-2 text-right w-24 bg-white/5">AUD Cost</th>
                <th className="px-2 py-2 text-right w-20">LUX M%</th>
                <th className="px-2 py-2 text-right w-24 bg-white/5">LUX exGST</th>
                <th className="px-2 py-2 text-right w-20 bg-white/5">LUX GST</th>
                <th className="px-2 py-2 text-right w-24 bg-white/5">LUX incGST</th>
                <th className="px-2 py-2 text-right w-24 bg-white/5">Profit</th>
                <th className="px-2 py-2 text-right w-20 bg-blue-500/20">Res M%</th>
                <th className="px-2 py-2 text-right w-24 bg-blue-500/20">Res exGST</th>
                <th className="px-2 py-2 text-right w-20 bg-blue-500/20">Res GST</th>
                <th className="px-2 py-2 text-right w-24 bg-blue-500/20">Res incGST</th>
                <th className="px-2 py-2 text-right w-24 bg-blue-500/20">Res Profit</th>
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
                    <td className={`px-2 py-1 sticky left-0 z-10 ${rowBg} border-r border-gray-200`}>
                      <input
                        className={`w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 ${isFree ? "line-through text-gray-400" : ""}`}
                        value={item.itemName}
                        onChange={(e) => updateItem(idx, "itemName", e.target.value)}
                      />
                      {item.productName && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 font-medium">
                            {item.productName}{item.pixelPitch ? ` • ${item.pixelPitch}mm` : ''}
                          </span>
                          <button onClick={() => unlinkProduct(idx)} className="text-xs text-gray-400 hover:text-red-500" title="Unlink product">&times;</button>
                        </div>
                      )}
                      {!item.productName && (
                        <button
                          onClick={() => setShowProductPicker({ mode: 'link', itemIdx: idx })}
                          className="text-xs text-gray-400 hover:text-blue-600 mt-0.5 flex items-center gap-0.5"
                          title="Link to product catalog"
                        >
                          🔗 Link product
                        </button>
                      )}
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
                      <NumericInput
                        step="1"
                        className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 text-right"
                        value={item.qty}
                        onChange={(v) => updateItem(idx, "qty", v)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <NumericInput
                        step="0.01"
                        className={`w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 text-right ${isLocal ? "text-gray-300 cursor-not-allowed" : ""}`}
                        value={item.usdUnitPrice ?? 0}
                        disabled={isLocal}
                        onChange={(v) => updateItem(idx, "usdUnitPrice", v)}
                      />
                    </td>
                    <td className={`px-2 py-1 text-right bg-gray-50 text-gray-600 ${isFree ? "line-through" : ""}`}>
                      {fmt(calc.usdSubtotal)}
                    </td>
                    <td className="px-2 py-1 text-right bg-gray-50">
                      {isLocal ? (
                        <NumericInput
                          step="0.01"
                          className="w-full bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 text-right"
                          value={item.audLocalCost ?? 0}
                          onChange={(v) => updateItem(idx, "audLocalCost", v)}
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
                    {/* Reseller columns */}
                    <td className="px-2 py-1 bg-blue-50/50">
                      <input
                        type="number"
                        step="0.1"
                        className="w-full bg-transparent border border-transparent hover:border-blue-200 focus:border-blue-400 focus:outline-none rounded px-1 py-0.5 text-right"
                        placeholder={fmtPct(settings.defaultResellerMargin)}
                        value={item.resellerMarginOverride != null ? (item.resellerMarginOverride * 100).toFixed(1) : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateItem(idx, "resellerMarginOverride", v === "" ? null : (parseFloat(v) || 0) / 100);
                        }}
                      />
                    </td>
                    <td className={`px-2 py-1 text-right bg-blue-50/50 text-blue-700 ${isFree ? "line-through" : ""}`}>
                      {fmt(calc.resellerSellExGst)}
                    </td>
                    <td className={`px-2 py-1 text-right bg-blue-50/50 text-blue-700 ${isFree ? "line-through" : ""}`}>
                      {fmt(calc.resellerGst)}
                    </td>
                    <td className={`px-2 py-1 text-right bg-blue-50/50 text-blue-700 ${isFree ? "line-through" : ""}`}>
                      {fmt(calc.resellerSellIncGst)}
                    </td>
                    <td className={`px-2 py-1 text-right bg-blue-50/50 text-blue-700 ${isFree ? "line-through" : ""}`}>
                      {fmt(calc.resellerProfit)}
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
                <td className="px-2 py-2 text-right"></td>
                <td className="px-2 py-2 text-right text-blue-700">{fmt(totals.totalResellerSellExGst)}</td>
                <td className="px-2 py-2 text-right text-blue-700">{fmt(totals.totalResellerGst)}</td>
                <td className="px-2 py-2 text-right text-blue-800 font-extrabold">{fmt(totals.totalResellerSellIncGst)}</td>
                <td className="px-2 py-2 text-right text-blue-700">{fmt(totals.totalResellerProfit)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 p-3 border-t bg-gray-50">
          <button
            onClick={() => addItem()}
            className="px-3 py-2 sm:py-1.5 text-sm bg-[#0D1B2A] text-white rounded hover:bg-[#1a2d42] transition-colors"
          >
            + Add Item
          </button>
          <button
            onClick={() => addItem({ itemName: "Freight", isLocal: true, unit: "JOB" })}
            className="px-3 py-2 sm:py-1.5 text-sm bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors"
          >
            + Freight
          </button>
          <button
            onClick={() => addItem({ itemName: "Frame Build & Install", isLocal: true, unit: "JOB" })}
            className="px-3 py-2 sm:py-1.5 text-sm bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors"
          >
            + Frame Build
          </button>
          <button
            onClick={() => setShowProductPicker({ mode: 'add', itemIdx: null })}
            className="px-3 py-2 sm:py-1.5 text-sm bg-blue-50 text-blue-800 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
          >
            🔗 From Catalog
          </button>

          <div className="hidden sm:flex ml-auto gap-2 text-xs text-gray-500">
            <label className="flex items-center gap-1">
              <span>Tip: Leave margin blank to use quote default</span>
            </label>
          </div>
        </div>
      </div>

      {/* Product Picker Modal */}
      {showProductPicker && (
        <ProductPicker
          onSelect={handleProductSelected}
          onClose={() => setShowProductPicker(null)}
        />
      )}

      {/* Freight Calculator Modal */}
      {showFreight && (
        <FreightCalculator
          quoteId={quote.id}
          quoteName={quote.name}
          fxRate={quote.fxRate}
          lineItems={items}
          onClose={() => setShowFreight(false)}
        />
      )}
    </div>
  );
}
