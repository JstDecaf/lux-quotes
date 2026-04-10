"use client";

import { useEffect, useState } from "react";

interface FxRatePoint {
  date: string;
  rateAudUsd: number;
}

interface Props {
  initialData: FxRatePoint[];
  avgQuotedRate: number | null;
}

export function DashboardFxChart({ initialData, avgQuotedRate }: Props) {
  const [data, setData] = useState(initialData);
  const [backfilling, setBackfilling] = useState(false);

  // Auto-backfill if we have fewer than 30 data points
  useEffect(() => {
    if (data.length < 30 && !backfilling) {
      setBackfilling(true);
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      fetch("/api/fx/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: sixMonthsAgo, to: today }),
      })
        .then((res) => {
          if (res.ok) {
            return fetch(`/api/fx/history?from=${sixMonthsAgo}&to=${today}`);
          }
          return null;
        })
        .then((res) => res?.json())
        .then((newData) => {
          if (newData?.length) setData(newData);
        })
        .finally(() => setBackfilling(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (data.length === 0) {
    return (
      <div className="card p-6 h-full">
        <h3 className="text-sm font-semibold text-lux-charcoal mb-2">AUD/USD Exchange Rate</h3>
        <p className="text-xs text-lux-steel">
          {backfilling ? "Loading rate history..." : "No FX data available yet."}
        </p>
      </div>
    );
  }

  const rates = data.map((d) => d.rateAudUsd);
  const current = rates[rates.length - 1];
  const high = Math.max(...rates);
  const low = Math.min(...rates);

  const avg30 = rates.slice(-22).reduce((s, r) => s + r, 0) / Math.min(rates.length, 22);
  const avg90 = rates.slice(-65).reduce((s, r) => s + r, 0) / Math.min(rates.length, 65);
  const avg180 = rates.reduce((s, r) => s + r, 0) / rates.length;

  // Trend: compare last 5 days average to previous 5 days average
  const recent5 = rates.slice(-5);
  const prev5 = rates.slice(-10, -5);
  const trendUp = recent5.length > 0 && prev5.length > 0 &&
    recent5.reduce((s, r) => s + r, 0) / recent5.length > prev5.reduce((s, r) => s + r, 0) / prev5.length;

  return (
    <div className="card p-6 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-lux-charcoal">AUD/USD Exchange Rate</h3>
        <span className="text-[10px] text-lux-steel">{data.length} days</span>
      </div>

      <FxAreaChart data={data} avgQuotedRate={avgQuotedRate} />

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
        <Stat label="Current" value={current.toFixed(4)} highlight color={trendUp ? "text-green-600" : "text-red-600"} />
        <Stat label="30d Avg" value={avg30.toFixed(4)} />
        <Stat label="90d Avg" value={avg90.toFixed(4)} />
        <Stat label="180d Avg" value={avg180.toFixed(4)} />
        <Stat label="High" value={high.toFixed(4)} />
        <Stat label="Low" value={low.toFixed(4)} />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-lux-steel uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-mono font-bold ${highlight && color ? color : "text-lux-black"}`}>{value}</p>
    </div>
  );
}

function FxAreaChart({ data, avgQuotedRate }: { data: FxRatePoint[]; avgQuotedRate: number | null }) {
  const width = 600;
  const height = 140;
  const px = 36;
  const py = 12;

  const rates = data.map((d) => d.rateAudUsd);
  const allVals = avgQuotedRate ? [...rates, avgQuotedRate] : rates;
  const minR = Math.min(...allVals) - 0.005;
  const maxR = Math.max(...allVals) + 0.005;
  const range = maxR - minR || 0.01;

  const chartW = width - px * 2;
  const chartH = height - py * 2;

  const xS = (i: number) => px + (i / (data.length - 1)) * chartW;
  const yS = (v: number) => py + (1 - (v - minR) / range) * chartH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xS(i).toFixed(1)} ${yS(d.rateAudUsd).toFixed(1)}`).join(" ");

  // Area fill from line to bottom
  const areaPath = linePath +
    ` L ${xS(data.length - 1).toFixed(1)} ${(height - py).toFixed(1)}` +
    ` L ${xS(0).toFixed(1)} ${(height - py).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Gradient fill */}
      <defs>
        <linearGradient id="fxGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#fxGrad)" />

      {/* Avg quoted rate reference line */}
      {avgQuotedRate && (
        <>
          <line x1={px} y1={yS(avgQuotedRate)} x2={width - px} y2={yS(avgQuotedRate)} stroke="#F97316" strokeWidth="1" strokeDasharray="4 3" />
          <text x={width - px + 3} y={yS(avgQuotedRate) + 3} className="fill-orange-400" fontSize="8">
            Avg Quoted
          </text>
        </>
      )}

      {/* Rate line */}
      <path d={linePath} fill="none" stroke="#3B82F6" strokeWidth="1.5" />

      {/* Latest dot */}
      <circle cx={xS(data.length - 1)} cy={yS(rates[rates.length - 1])} r="3" fill="#3B82F6" />

      {/* Date labels */}
      <text x={px} y={height - 1} textAnchor="start" className="fill-gray-400" fontSize="8">{data[0].date.slice(0, 7)}</text>
      <text x={width - px} y={height - 1} textAnchor="end" className="fill-gray-400" fontSize="8">{data[data.length - 1].date.slice(0, 7)}</text>

      {/* Y labels */}
      <text x={px - 3} y={py + 3} textAnchor="end" className="fill-gray-300" fontSize="7">{maxR.toFixed(3)}</text>
      <text x={px - 3} y={height - py + 3} textAnchor="end" className="fill-gray-300" fontSize="7">{minR.toFixed(3)}</text>
    </svg>
  );
}
