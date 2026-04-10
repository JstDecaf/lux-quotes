export const dynamic = "force-dynamic";

import { db, schema } from "@/lib/db";
import { eq, desc, gte, asc } from "drizzle-orm";
import Link from "next/link";
import { DashboardFxChart } from "@/components/dashboard-fx-chart";
import { DashboardFxSensitivity } from "@/components/dashboard-fx-sensitivity";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const fmt = (v: number) =>
  "$" + v.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STATUS_STYLE: Record<string, string> = {
  draft:           "bg-gray-100 text-gray-600",
  active:          "bg-orange-50 text-orange-600",
  sent:            "bg-blue-50 text-blue-700",
  won:             "bg-emerald-50 text-emerald-700",
  lost:            "bg-red-50 text-red-600",
  expired:         "bg-amber-50 text-amber-700",
  converted_to_pi: "bg-purple-50 text-purple-700",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getDateStr() {
  return new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function Dashboard() {
  const allQuotes = await db
    .select({
      id: schema.quotes.id,
      quoteNumber: schema.quotes.quoteNumber,
      name: schema.quotes.name,
      status: schema.quotes.status,
      fxRate: schema.quotes.fxRate,
      cachedTotalUsd: schema.quotes.cachedTotalUsd,
      cachedTotalAudSellIncGst: schema.quotes.cachedTotalAudSellIncGst,
      cachedTotalGrossProfit: schema.quotes.cachedTotalGrossProfit,
      validUntil: schema.quotes.validUntil,
      createdAt: schema.quotes.createdAt,
      updatedAt: schema.quotes.updatedAt,
      clientName: schema.clients.name,
      projectName: schema.projects.name,
    })
    .from(schema.quotes)
    .leftJoin(schema.projects, eq(schema.quotes.projectId, schema.projects.id))
    .leftJoin(schema.clients, eq(schema.projects.clientId, schema.clients.id))
    .orderBy(desc(schema.quotes.updatedAt))
    .all();

  const clientCount = (await db.select({ id: schema.clients.id }).from(schema.clients).all()).length;

  type QuoteRow = typeof allQuotes[number];
  const byStatus = allQuotes.reduce((acc: Record<string, { count: number; value: number; profit: number }>, q: QuoteRow) => {
    const s = q.status ?? "draft";
    if (!acc[s]) acc[s] = { count: 0, value: 0, profit: 0 };
    acc[s].count++;
    acc[s].value += q.cachedTotalAudSellIncGst ?? 0;
    acc[s].profit += q.cachedTotalGrossProfit ?? 0;
    return acc;
  }, {} as Record<string, { count: number; value: number; profit: number }>);

  const pipeline = (byStatus.active?.value ?? 0) + (byStatus.sent?.value ?? 0);
  const pipelineCount = (byStatus.active?.count ?? 0) + (byStatus.sent?.count ?? 0);
  const wonValue = byStatus.won?.value ?? 0;
  const wonCount = byStatus.won?.count ?? 0;
  const sentValue = byStatus.sent?.value ?? 0;
  const sentCount = byStatus.sent?.count ?? 0;

  const wonTotal = byStatus.won?.count ?? 0;
  const lostTotal = byStatus.lost?.count ?? 0;
  const winRate = wonTotal + lostTotal > 0 ? Math.round((wonTotal / (wonTotal + lostTotal)) * 100) : null;

  // FX P/L
  const latestSnapshots = await db.select().from(schema.quoteFxSnapshots).orderBy(desc(schema.quoteFxSnapshots.date)).all();
  const latestByQuote = new Map<number, number>();
  for (const snap of latestSnapshots) {
    if (!latestByQuote.has(snap.quoteId)) latestByQuote.set(snap.quoteId, snap.plImpactAud);
  }
  const activeQuoteIds = new Set(allQuotes.filter((q: QuoteRow) => q.status === "active" || q.status === "sent").map((q: QuoteRow) => q.id));
  let totalFxPl = 0;
  for (const [qId, pl] of latestByQuote) {
    if (activeQuoteIds.has(qId)) totalFxPl += pl;
  }

  // Expiring
  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];
  const expiringSoon = allQuotes.filter((q: QuoteRow) => q.validUntil && q.validUntil <= sevenDaysOut && q.validUntil >= today && (q.status === "active" || q.status === "sent"));
  const alreadyExpired = allQuotes.filter((q: QuoteRow) => q.validUntil && q.validUntil < today && (q.status === "active" || q.status === "sent"));

  // FX history
  const sixMonthsAgo = new Date(now.getTime() - 180 * 86400000).toISOString().split("T")[0];
  const fxHistory = await db.select().from(schema.fxRateHistory).where(gte(schema.fxRateHistory.date, sixMonthsAgo)).orderBy(asc(schema.fxRateHistory.date)).all();
  const currentRate = fxHistory.length > 0 ? fxHistory[fxHistory.length - 1].rateAudUsd : 0;

  const activeSentQuotes = allQuotes.filter((q: QuoteRow) => q.status === "active" || q.status === "sent");
  const avgQuotedRate = activeSentQuotes.length > 0 ? activeSentQuotes.reduce((s: number, q: QuoteRow) => s + q.fxRate, 0) / activeSentQuotes.length : null;
  const totalPipelineUsd = activeSentQuotes.reduce((s: number, q: QuoteRow) => s + (q.cachedTotalUsd ?? 0), 0);

  // Shipping
  const latestShipping = await db.select().from(schema.shippingCosts).orderBy(desc(schema.shippingCosts.date)).all();
  const latestSea = latestShipping.find((s: typeof latestShipping[number]) => s.mode.startsWith("sea") && s.costPerCbm);
  const latestAir = latestShipping.find((s: typeof latestShipping[number]) => s.mode === "air" && s.costPerCbm);

  const recent = allQuotes.slice(0, 8);
  const statusEntries = Object.entries(byStatus) as [string, { count: number; value: number; profit: number }][];
  const totalValue = statusEntries.reduce((s, [, v]) => s + v.value, 0);
  const pct = (v: number) => totalValue > 0 ? `${((v / totalValue) * 100).toFixed(1)}%` : "0%";

  const kpiCards = [
    { label: "Pipeline", value: fmt(pipeline), sub: `${pipelineCount} open quotes`, accent: "border-l-orange-400", icon: "📊" },
    { label: "Sent", value: fmt(sentValue), sub: `${sentCount} awaiting`, accent: "border-l-blue-400", icon: "📤" },
    { label: "Won", value: fmt(wonValue), sub: `${wonCount} quotes`, accent: "border-l-emerald-400", icon: "🏆" },
    { label: "Win Rate", value: winRate !== null ? `${winRate}%` : "—", sub: `${wonTotal}W / ${lostTotal}L`, accent: "border-l-purple-400", icon: "📈" },
    { label: "FX P/L", value: totalFxPl !== 0 ? (totalFxPl >= 0 ? "+" : "") + fmt(totalFxPl) : "—", sub: "active quotes", accent: totalFxPl >= 0 ? "border-l-emerald-400" : "border-l-red-400", icon: "💱", valueColor: totalFxPl >= 0 ? "text-emerald-600" : "text-red-600" },
    { label: "Clients", value: String(clientCount), sub: `${allQuotes.length} total quotes`, accent: "border-l-gray-300", icon: "👥" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <ScrollReveal duration={0.4}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
          <div>
            <h1 className="font-archivo text-2xl sm:text-3xl font-bold text-lux-black">
              {getGreeting()}, Simon
            </h1>
            <p className="text-sm text-lux-steel mt-1">{getDateStr()}</p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Link href="/import" className="px-4 py-2.5 card card-hover text-sm font-medium text-lux-charcoal inline-flex items-center gap-2">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Import XLS
            </Link>
            <Link href="/quotes" className="px-4 py-2.5 bg-lux-red text-white rounded-xl text-sm font-medium hover:bg-[#c23823] inline-flex items-center gap-2 shadow-sm">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" />
              </svg>
              New Quote
            </Link>
          </div>
        </div>
      </ScrollReveal>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {kpiCards.map((kpi, i) => (
          <ScrollReveal key={kpi.label} delay={i * 0.06} duration={0.4}>
            <div className={`card card-hover p-5 border-l-4 ${kpi.accent}`}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-semibold text-lux-steel uppercase tracking-wider">{kpi.label}</p>
                <span className="text-lg">{kpi.icon}</span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${(kpi as { valueColor?: string }).valueColor || "text-lux-black"}`}>{kpi.value}</p>
              <p className="text-[11px] text-lux-steel mt-1">{kpi.sub}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* Pipeline breakdown */}
      {totalValue > 0 && (
        <ScrollReveal delay={0.2}>
          <div className="card p-6 mb-6">
            <p className="text-[10px] font-semibold text-lux-steel uppercase tracking-wider mb-3">Pipeline Breakdown</p>
            <div className="flex rounded-full overflow-hidden h-3 mb-3">
              {byStatus.won    && <div style={{ width: pct(byStatus.won.value)    }} className="bg-emerald-500" title={`Won: ${fmt(byStatus.won.value)}`} />}
              {byStatus.sent   && <div style={{ width: pct(byStatus.sent.value)   }} className="bg-blue-400"   title={`Sent: ${fmt(byStatus.sent.value)}`} />}
              {byStatus.active && <div style={{ width: pct(byStatus.active.value) }} className="bg-orange-400" title={`Active: ${fmt(byStatus.active.value)}`} />}
              {byStatus.draft  && <div style={{ width: pct(byStatus.draft.value)  }} className="bg-gray-200"   title={`Draft: ${fmt(byStatus.draft.value)}`} />}
              {byStatus.lost   && <div style={{ width: pct(byStatus.lost.value)   }} className="bg-red-300"    title={`Lost: ${fmt(byStatus.lost.value)}`} />}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-lux-steel">
              {[
                { key: "won",    label: "Won",    color: "bg-emerald-500" },
                { key: "sent",   label: "Sent",   color: "bg-blue-400" },
                { key: "active", label: "Active", color: "bg-orange-400" },
                { key: "draft",  label: "Draft",  color: "bg-gray-300" },
                { key: "lost",   label: "Lost",   color: "bg-red-300" },
              ].filter(({ key }) => byStatus[key]).map(({ key, label, color }) => (
                <span key={key} className="flex items-center gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
                  {label}: {fmt(byStatus[key].value)} ({byStatus[key].count})
                </span>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* FX Chart + Sensitivity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ScrollReveal className="lg:col-span-2">
          <DashboardFxChart
            initialData={fxHistory.map((r: typeof fxHistory[number]) => ({ date: r.date, rateAudUsd: r.rateAudUsd }))}
            avgQuotedRate={avgQuotedRate}
          />
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <DashboardFxSensitivity
            totalPipelineUsd={totalPipelineUsd}
            currentRate={currentRate}
            avgQuotedRate={avgQuotedRate ?? currentRate}
          />
        </ScrollReveal>
      </div>

      {/* Shipping + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ScrollReveal>
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-lux-charcoal">Shipping Costs</h3>
              <Link href="/shipping" className="text-xs text-lux-red hover:underline">View all →</Link>
            </div>
            {latestSea || latestAir ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-lux-steel uppercase tracking-wider">Sea $/CBM</p>
                  <p className="text-xl font-bold text-blue-600 mt-1">{latestSea ? `$${latestSea.costPerCbm!.toFixed(0)}` : "—"}</p>
                  {latestSea && <p className="text-[10px] text-lux-steel">{latestSea.date} · {latestSea.forwarder ?? "—"}</p>}
                </div>
                <div>
                  <p className="text-[10px] text-lux-steel uppercase tracking-wider">Air $/CBM</p>
                  <p className="text-xl font-bold text-orange-600 mt-1">{latestAir ? `$${latestAir.costPerCbm!.toFixed(0)}` : "—"}</p>
                  {latestAir && <p className="text-[10px] text-lux-steel">{latestAir.date} · {latestAir.forwarder ?? "—"}</p>}
                </div>
              </div>
            ) : (
              <p className="text-xs text-lux-steel">No data yet. <Link href="/shipping" className="text-lux-red hover:underline">Add entry</Link></p>
            )}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-lux-charcoal mb-4">Quote Alerts</h3>
            {alreadyExpired.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-red-600 mb-1.5">Expired ({alreadyExpired.length})</p>
                {alreadyExpired.slice(0, 3).map((q: QuoteRow) => (
                  <Link key={q.id} href={`/quotes/${q.id}`} className="block text-xs text-lux-steel hover:text-lux-red py-0.5">
                    {q.quoteNumber} — {q.clientName} <span className="text-red-400">({q.validUntil})</span>
                  </Link>
                ))}
              </div>
            )}
            {expiringSoon.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-600 mb-1.5">Expiring soon ({expiringSoon.length})</p>
                {expiringSoon.map((q: QuoteRow) => {
                  const daysLeft = Math.ceil((new Date(q.validUntil!).getTime() - now.getTime()) / 86400000);
                  return (
                    <Link key={q.id} href={`/quotes/${q.id}`} className="block text-xs text-lux-steel hover:text-lux-red py-0.5">
                      {q.quoteNumber} — {q.clientName} <span className="text-amber-500">({daysLeft}d)</span>
                    </Link>
                  );
                })}
              </div>
            )}
            {expiringSoon.length === 0 && alreadyExpired.length === 0 && (
              <p className="text-xs text-lux-steel">No alerts right now.</p>
            )}
          </div>
        </ScrollReveal>
      </div>

      {/* Recent Quotes */}
      <ScrollReveal>
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100/80 flex items-center justify-between">
            <h2 className="font-archivo text-sm font-semibold text-lux-charcoal">Recent Quotes</h2>
            <Link href="/quotes" className="text-xs text-lux-red hover:underline">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-lux-light/50">
                  <th className="px-6 py-3 text-left text-[10px] font-semibold text-lux-steel uppercase tracking-wider">Quote</th>
                  <th className="px-6 py-3 text-left text-[10px] font-semibold text-lux-steel uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-[10px] font-semibold text-lux-steel uppercase tracking-wider hidden sm:table-cell">Project</th>
                  <th className="px-6 py-3 text-left text-[10px] font-semibold text-lux-steel uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-[10px] font-semibold text-lux-steel uppercase tracking-wider">Value</th>
                  <th className="px-6 py-3 text-right text-[10px] font-semibold text-lux-steel uppercase tracking-wider hidden md:table-cell">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((q: QuoteRow) => (
                  <tr key={q.id} className="hover:bg-lux-warm/50">
                    <td className="px-6 py-3.5">
                      <Link href={`/quotes/${q.id}`} className="font-medium text-lux-red hover:underline text-xs">
                        {q.quoteNumber}
                      </Link>
                      <p className="text-[11px] text-lux-steel truncate max-w-[180px]">{q.name}</p>
                    </td>
                    <td className="px-6 py-3.5 text-lux-charcoal text-xs">{q.clientName ?? "—"}</td>
                    <td className="px-6 py-3.5 text-lux-steel text-xs hidden sm:table-cell">{q.projectName ?? "—"}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize ${STATUS_STYLE[q.status ?? "draft"]}`}>
                        {q.status ?? "draft"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-medium text-lux-charcoal text-xs">
                      {q.cachedTotalAudSellIncGst ? fmt(q.cachedTotalAudSellIncGst) : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-right font-medium text-emerald-600 text-xs hidden md:table-cell">
                      {q.cachedTotalGrossProfit ? fmt(q.cachedTotalGrossProfit) : "—"}
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-lux-steel text-sm">
                      No quotes yet. <Link href="/import" className="text-lux-red hover:underline">Import an XLS</Link> to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
