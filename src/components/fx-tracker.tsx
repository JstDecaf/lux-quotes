"use client";

import { useEffect, useState } from "react";

interface FxSnapshot {
  date: string;
  marketRate: number;
  plImpactAud: number;
}

interface FxRatePoint {
  date: string;
  rateAudUsd: number;
}

interface Props {
  quoteId: number;
  quotedRate: number;
  totalUsd: number;
  createdAt: string;
}

function fmt(val: number): string {
  const prefix = val >= 0 ? "+$" : "-$";
  return prefix + Math.abs(val).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function FxTracker({ quoteId, quotedRate, totalUsd, createdAt }: Props) {
  const [snapshots, setSnapshots] = useState<FxSnapshot[]>([]);
  const [rateHistory, setRateHistory] = useState<FxRatePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);

  const fromDate = createdAt.split("T")[0].split(" ")[0];
  const toDate = new Date().toISOString().split("T")[0];

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/quotes/${quoteId}/fx-snapshots`).then((r) => r.json()),
      fetch(`/api/fx/history?from=${fromDate}&to=${toDate}`).then((r) => r.json()),
    ])
      .then(([snaps, history]) => {
        setSnapshots(snaps);
        setRateHistory(history);
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadData, [quoteId, fromDate, toDate]);

  if (totalUsd <= 0) return null;

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const latestRate = latestSnapshot?.marketRate ?? (rateHistory.length > 0 ? rateHistory[rateHistory.length - 1].rateAudUsd : null);
  const currentPlImpact = latestRate ? (totalUsd / quotedRate) - (totalUsd / latestRate) : null;
  const plDisplay = latestSnapshot?.plImpactAud ?? currentPlImpact;

  // Check if backfill might be useful (quote is older than 1 day and we have fewer snapshots than expected)
  const quoteAgeDays = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  const hasGaps = quoteAgeDays > 1 && snapshots.length < Math.max(1, quoteAgeDays - 2);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await fetch("/api/fx/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromDate, to: toDate, quoteId }),
      });
      if (res.ok) {
        loadData(); // Reload data after backfill
      } else {
        const err = await res.json();
        alert(err.error || "Backfill failed");
      }
    } catch {
      alert("Backfill failed");
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">FX Rate Tracker</h3>
        {hasGaps && (
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2.5 py-1 hover:bg-blue-50 disabled:opacity-50"
          >
            {backfilling ? "Backfilling..." : "Backfill History"}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-[var(--text-faint)] animate-pulse">Loading FX data...</p>
      ) : (
        <>
          {/* Summary row */}
          <div className="flex flex-wrap gap-5 mb-4">
            <div>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Quoted</span>
              <p className="text-base font-mono font-bold text-[var(--text-primary)]">{quotedRate.toFixed(4)}</p>
            </div>
            {latestRate && (
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Market</span>
                <p className="text-base font-mono font-bold text-[var(--text-primary)]">{latestRate.toFixed(4)}</p>
              </div>
            )}
            {plDisplay !== null && (
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">P/L Impact</span>
                <p className={`text-base font-mono font-bold ${plDisplay >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmt(plDisplay)}
                </p>
              </div>
            )}
            <div>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">USD Exposure</span>
              <p className="text-base font-mono font-bold text-[var(--text-secondary)]">
                US${totalUsd.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Sparkline chart */}
          {rateHistory.length > 1 && (
            <SparklineChart data={rateHistory} quotedRate={quotedRate} snapshots={snapshots} />
          )}

          {rateHistory.length <= 1 && (
            <p className="text-xs text-[var(--text-faint)]">
              {rateHistory.length === 0
                ? "No FX history data yet. Click 'Backfill History' or wait for the daily update."
                : "Need at least 2 data points for a chart."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Sparkline Chart (pure SVG) ──────────────────────────────────────────────

function SparklineChart({
  data,
  quotedRate,
  snapshots,
}: {
  data: FxRatePoint[];
  quotedRate: number;
  snapshots: FxSnapshot[];
}) {
  const width = 500;
  const height = 100;
  const paddingX = 36;
  const paddingY = 12;

  const rates = data.map((d) => d.rateAudUsd);
  const allValues = [...rates, quotedRate];
  const minRate = Math.min(...allValues) - 0.003;
  const maxRate = Math.max(...allValues) + 0.003;
  const range = maxRate - minRate || 0.01;

  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const xScale = (i: number) => paddingX + (i / (data.length - 1)) * chartW;
  const yScale = (v: number) => paddingY + (1 - (v - minRate) / range) * chartH;

  const quotedY = yScale(quotedRate);

  // Line path
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(d.rateAudUsd).toFixed(1)}`)
    .join(" ");

  // Fill area between line and quoted rate
  const fillPath =
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(d.rateAudUsd).toFixed(1)}`).join(" ") +
    ` L ${xScale(data.length - 1).toFixed(1)} ${quotedY.toFixed(1)}` +
    ` L ${xScale(0).toFixed(1)} ${quotedY.toFixed(1)} Z`;

  const latestAbove = rates[rates.length - 1] >= quotedRate;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Fill */}
      <path d={fillPath} fill={latestAbove ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"} />

      {/* Quoted rate line */}
      <line x1={paddingX} y1={quotedY} x2={width - paddingX} y2={quotedY} stroke="#D1D5DB" strokeWidth="1" strokeDasharray="3 2" />
      <text x={paddingX - 3} y={quotedY + 3} textAnchor="end" className="fill-gray-400" fontSize="8">
        {quotedRate.toFixed(3)}
      </text>

      {/* Rate line */}
      <path d={linePath} fill="none" stroke={latestAbove ? "#22C55E" : "#EF4444"} strokeWidth="1.5" />

      {/* Latest dot */}
      <circle cx={xScale(data.length - 1)} cy={yScale(rates[rates.length - 1])} r="2.5" fill={latestAbove ? "#22C55E" : "#EF4444"} />

      {/* Date labels */}
      <text x={paddingX} y={height - 1} textAnchor="start" className="fill-gray-400" fontSize="8">
        {data[0].date.slice(5)}
      </text>
      <text x={width - paddingX} y={height - 1} textAnchor="end" className="fill-gray-400" fontSize="8">
        {data[data.length - 1].date.slice(5)}
      </text>

      {/* Y min/max */}
      <text x={paddingX - 3} y={paddingY + 3} textAnchor="end" className="fill-gray-300" fontSize="7">
        {maxRate.toFixed(3)}
      </text>
      <text x={paddingX - 3} y={height - paddingY + 3} textAnchor="end" className="fill-gray-300" fontSize="7">
        {minRate.toFixed(3)}
      </text>
    </svg>
  );
}
