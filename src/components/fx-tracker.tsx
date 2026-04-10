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

  useEffect(() => {
    const from = createdAt.split("T")[0].split(" ")[0]; // handle both ISO and sqlite datetime
    const to = new Date().toISOString().split("T")[0];

    Promise.all([
      fetch(`/api/quotes/${quoteId}/fx-snapshots`).then((r) => r.json()),
      fetch(`/api/fx/history?from=${from}&to=${to}`).then((r) => r.json()),
    ])
      .then(([snaps, history]) => {
        setSnapshots(snaps);
        setRateHistory(history);
      })
      .finally(() => setLoading(false));
  }, [quoteId, createdAt]);

  if (totalUsd <= 0) return null;

  // Current state
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const latestRate = latestSnapshot?.marketRate ?? (rateHistory.length > 0 ? rateHistory[rateHistory.length - 1].rateAudUsd : null);

  // Calculate live P/L if we have a rate
  const currentPlImpact = latestRate
    ? (totalUsd / quotedRate) - (totalUsd / latestRate)
    : null;

  const plDisplay = latestSnapshot?.plImpactAud ?? currentPlImpact;

  return (
    <div className="bg-white rounded-lg border p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">FX Rate Tracker</h3>

      {loading ? (
        <p className="text-xs text-gray-400 animate-pulse">Loading FX data...</p>
      ) : (
        <>
          {/* Summary row */}
          <div className="flex flex-wrap gap-6 mb-4">
            <div>
              <span className="text-xs text-gray-500">Quoted Rate</span>
              <p className="text-lg font-mono font-bold text-gray-900">{quotedRate.toFixed(4)}</p>
            </div>
            {latestRate && (
              <div>
                <span className="text-xs text-gray-500">Latest Market Rate</span>
                <p className="text-lg font-mono font-bold text-gray-900">{latestRate.toFixed(4)}</p>
              </div>
            )}
            {plDisplay !== null && (
              <div>
                <span className="text-xs text-gray-500">FX P/L Impact</span>
                <p className={`text-lg font-mono font-bold ${plDisplay >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmt(plDisplay)}
                </p>
                <p className="text-[10px] text-gray-400">
                  {plDisplay >= 0 ? "Rate moved in your favour" : "Rate moved against you"}
                </p>
              </div>
            )}
            {totalUsd > 0 && (
              <div>
                <span className="text-xs text-gray-500">Total USD Exposure</span>
                <p className="text-lg font-mono font-bold text-gray-700">
                  US${totalUsd.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
          </div>

          {/* Sparkline chart */}
          {rateHistory.length > 1 && (
            <SparklineChart
              data={rateHistory}
              quotedRate={quotedRate}
            />
          )}

          {rateHistory.length === 0 && (
            <p className="text-xs text-gray-400">
              No FX history data yet. Rate tracking starts when the daily cron runs.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Sparkline Chart (pure SVG) ──────────────────────────────────────────────

function SparklineChart({ data, quotedRate }: { data: FxRatePoint[]; quotedRate: number }) {
  const width = 600;
  const height = 120;
  const paddingX = 40;
  const paddingY = 15;

  const rates = data.map((d) => d.rateAudUsd);
  const allValues = [...rates, quotedRate];
  const minRate = Math.min(...allValues) - 0.005;
  const maxRate = Math.max(...allValues) + 0.005;
  const range = maxRate - minRate || 0.01;

  const xScale = (i: number) => paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
  const yScale = (v: number) => paddingY + (1 - (v - minRate) / range) * (height - paddingY * 2);

  const quotedY = yScale(quotedRate);

  // Build path
  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(d.rateAudUsd).toFixed(1)}`).join(" ");

  // Build fill areas (above quoted = green, below = red)
  // For simplicity, draw a single fill from the line down to the quoted line
  const fillPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(d.rateAudUsd).toFixed(1)}`).join(" ")
    + ` L ${xScale(data.length - 1).toFixed(1)} ${quotedY.toFixed(1)}`
    + ` L ${xScale(0).toFixed(1)} ${quotedY.toFixed(1)} Z`;

  // Is the latest rate above or below quoted?
  const latestAbove = rates[rates.length - 1] >= quotedRate;

  // Y-axis labels
  const yLabels = [minRate, quotedRate, maxRate].sort((a, b) => a - b);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Fill area */}
        <path d={fillPath} fill={latestAbove ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"} />

        {/* Quoted rate reference line */}
        <line
          x1={paddingX}
          y1={quotedY}
          x2={width - paddingX}
          y2={quotedY}
          stroke="#9CA3AF"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <text x={paddingX - 4} y={quotedY + 3} textAnchor="end" className="fill-gray-400" fontSize="9">
          {quotedRate.toFixed(3)}
        </text>

        {/* Rate line */}
        <path d={linePath} fill="none" stroke={latestAbove ? "#22C55E" : "#EF4444"} strokeWidth="2" />

        {/* Dot on latest point */}
        <circle
          cx={xScale(data.length - 1)}
          cy={yScale(rates[rates.length - 1])}
          r="3"
          fill={latestAbove ? "#22C55E" : "#EF4444"}
        />

        {/* Date labels */}
        <text x={paddingX} y={height - 2} textAnchor="start" className="fill-gray-400" fontSize="9">
          {data[0].date.slice(5)}
        </text>
        <text x={width - paddingX} y={height - 2} textAnchor="end" className="fill-gray-400" fontSize="9">
          {data[data.length - 1].date.slice(5)}
        </text>

        {/* Y-axis min/max */}
        <text x={paddingX - 4} y={paddingY + 3} textAnchor="end" className="fill-gray-300" fontSize="8">
          {maxRate.toFixed(3)}
        </text>
        <text x={paddingX - 4} y={height - paddingY + 3} textAnchor="end" className="fill-gray-300" fontSize="8">
          {minRate.toFixed(3)}
        </text>
      </svg>
    </div>
  );
}
