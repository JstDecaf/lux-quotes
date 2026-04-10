interface Props {
  totalPipelineUsd: number;
  currentRate: number;
  avgQuotedRate: number;
}

const fmt = (v: number) => {
  const prefix = v >= 0 ? "+$" : "-$";
  return prefix + Math.abs(v).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const scenarios = [-5, -3, -1, 0, 1, 3, 5];

export function DashboardFxSensitivity({ totalPipelineUsd, currentRate, avgQuotedRate }: Props) {
  if (totalPipelineUsd <= 0 || currentRate <= 0) return null;

  // Base cost at quoted rate
  const baseCost = totalPipelineUsd / avgQuotedRate;

  return (
    <div className="card p-6 h-full">
      <h3 className="text-sm font-semibold text-lux-charcoal mb-1">FX Sensitivity</h3>
      <p className="text-[10px] text-lux-steel mb-3">
        Pipeline impact if AUD/USD moves from {currentRate.toFixed(3)}
      </p>

      <div className="space-y-1.5">
        {scenarios.map((pct) => {
          const scenarioRate = currentRate * (1 + pct / 100);
          const scenarioCost = totalPipelineUsd / scenarioRate;
          const delta = baseCost - scenarioCost;
          const isNeutral = pct === 0;

          return (
            <div
              key={pct}
              className={`flex items-center justify-between py-1.5 px-3 rounded text-xs ${
                isNeutral ? "bg-lux-light/50 font-medium" : ""
              }`}
            >
              <span className="text-gray-600">
                {pct === 0 ? "Current rate" : pct > 0 ? `AUD +${pct}%` : `AUD ${pct}%`}
              </span>
              <span className="font-mono text-gray-400 text-[10px]">{scenarioRate.toFixed(4)}</span>
              <span
                className={`font-mono font-medium ${
                  isNeutral
                    ? "text-gray-500"
                    : delta >= 0
                      ? "text-green-600"
                      : "text-red-600"
                }`}
              >
                {isNeutral ? "—" : fmt(delta)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-lux-steel mt-3">
        Based on US${totalPipelineUsd.toLocaleString("en-AU", { maximumFractionDigits: 0 })} pipeline exposure
      </p>
    </div>
  );
}
