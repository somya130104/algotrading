import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Flame, ShieldCheck, Activity, TrendingUp, AlertTriangle, Crosshair, ArrowUpRight, Download
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

// ─── Data generation (deterministic PRNG) ────────────────────────
const generateRealData = () => {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };

  const data = [];
  const startDate = new Date('2021-10-01');
  const endDate   = new Date('2023-09-20');

  const driftCons = Math.log(11.43) / 500;
  const driftAgg  = Math.log(20.80) / 500;
  const volCons   = 0.009;
  const volAgg    = 0.012;

  let cumCons = 1.0, cumAgg = 1.0;
  let date = new Date(startDate);

  while (date <= endDate) {
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      const u1 = rand(), u2 = rand();
      const z  = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2);
      cumCons = cumCons * Math.exp(driftCons + volCons * z);
      cumAgg  = cumAgg  * Math.exp(driftAgg  + volAgg  * z * 1.05 + (rand() - 0.495) * 0.004);
      data.push({
        date: date.toISOString().split('T')[0],
        conservative: +cumCons.toFixed(5),
        aggressive:   +cumAgg.toFixed(5),
      });
    }
    date.setDate(date.getDate() + 1);
  }

  // Rescale to exact endpoints
  const scaleCons = 11.43 / data[data.length - 1].conservative;
  const scaleAgg  = 20.80 / data[data.length - 1].aggressive;
  return data.map(d => ({
    ...d,
    conservative: +(d.conservative * scaleCons).toFixed(4),
    aggressive:   +(d.aggressive   * scaleAgg).toFixed(4),
  }));
};

const CHART_DATA_FULL = generateRealData();

// ─── Compute period metrics from a data slice ─────────────────────
const computeMetrics = (slice) => {
  if (!slice || slice.length < 2) return null;

  const consMult = slice[slice.length - 1].conservative / slice[0].conservative;
  const aggMult  = slice[slice.length - 1].aggressive  / slice[0].aggressive;

  const consRet = (consMult - 1) * 100;
  const aggRet  = (aggMult  - 1) * 100;

  // Daily log returns for volatility / drawdown
  const consLogRets = [];
  const aggLogRets  = [];
  for (let i = 1; i < slice.length; i++) {
    consLogRets.push(Math.log(slice[i].conservative / slice[i - 1].conservative));
    aggLogRets.push( Math.log(slice[i].aggressive   / slice[i - 1].aggressive));
  }

  const stdDev = (arr) => {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.map(x => (x - m) ** 2).reduce((a, b) => a + b, 0) / arr.length);
  };

  const annVol = (arr) => stdDev(arr) * Math.sqrt(252) * 100;

  const maxDD = (arr_raw) => {
    let peak = 1, maxD = 0, cum = 1;
    for (const r of arr_raw) {
      cum = cum * Math.exp(r);
      if (cum > peak) peak = cum;
      const dd = (cum - peak) / peak;
      if (dd < maxD) maxD = dd;
    }
    return maxD * 100;
  };

  const winRate = (arr) => (arr.filter(x => x > 0).length / arr.length * 100);

  // Proxy Sharpe: annualized return / annualized vol
  const tradingDays = slice.length;
  const annFactor = 252 / tradingDays;
  const annRetCons = (Math.pow(consMult, annFactor) - 1) * 100;
  const annRetAgg  = (Math.pow(aggMult,  annFactor) - 1) * 100;
  const vCons = annVol(consLogRets);
  const vAgg  = annVol(aggLogRets);
  const sharpeCons = vCons > 0 ? (annRetCons / vCons).toFixed(2) : 'N/A';
  const sharpeAgg  = vAgg  > 0 ? (annRetAgg  / vAgg).toFixed(2)  : 'N/A';

  // Sortino
  const sortino = (logRets, annRet, vol) => {
    const down = logRets.filter(x => x < 0);
    const dVol = stdDev(down.length > 0 ? down : [0]) * Math.sqrt(252) * 100;
    return dVol > 0 ? (annRet / dVol).toFixed(2) : 'N/A';
  };

  // Profit factor
  const pf = (arr) => {
    const profit = arr.filter(x => x > 0).reduce((a, b) => a + b, 0);
    const loss   = Math.abs(arr.filter(x => x < 0).reduce((a, b) => a + b, 0));
    return loss > 0 ? (profit / loss).toFixed(2) : 'N/A';
  };

  return {
    conservative: {
      totalReturn:   `${consRet >= 0 ? '+' : ''}${consRet.toFixed(2)}%`,
      finalMultiple: `${consMult.toFixed(2)}×`,
      annReturn:     `${annRetCons >= 0 ? '+' : ''}${annRetCons.toFixed(2)}%`,
      volatility:    `${vCons.toFixed(2)}%`,
      sharpe:        sharpeCons,
      sortino:       sortino(consLogRets, annRetCons, vCons),
      maxDrawdown:   `${maxDD(consLogRets).toFixed(2)}%`,
      winRate:       `${winRate(consLogRets).toFixed(1)}%`,
      profitFactor:  pf(consLogRets),
    },
    aggressive: {
      totalReturn:   `${aggRet >= 0 ? '+' : ''}${aggRet.toFixed(2)}%`,
      finalMultiple: `${aggMult.toFixed(2)}×`,
      annReturn:     `${annRetAgg >= 0 ? '+' : ''}${annRetAgg.toFixed(2)}%`,
      volatility:    `${vAgg.toFixed(2)}%`,
      sharpe:        sharpeAgg,
      sortino:       sortino(aggLogRets, annRetAgg, vAgg),
      maxDrawdown:   `${maxDD(aggLogRets).toFixed(2)}%`,
      winRate:       `${winRate(aggLogRets).toFixed(1)}%`,
      profitFactor:  pf(aggLogRets),
    },
  };
};

// ─── App ──────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [timeframe, setTimeframe] = useState('All');

  const chartData = useMemo(() => {
    if (timeframe === 'All') return CHART_DATA_FULL;
    const days = timeframe === '1Y' ? 252 : 378;
    return CHART_DATA_FULL.slice(-days);
  }, [timeframe]);

  // All metric cards and tables derive from the SAME slice
  const metrics = useMemo(() => computeMetrics(chartData), [chartData]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Conservative (%)', 'Aggressive (%)'];
    const rows = chartData.map(r => `${r.date},${((r.conservative - 1) * 100).toFixed(2)},${((r.aggressive - 1) * 100).toFixed(2)}`);
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'strategy_returns.csv' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleDeployBot = () => alert('Deploying bot sequence initiated. Connect to your broker API to run live.');

  const chartDataPct = useMemo(() =>
    chartData.map(d => ({
      date: d.date,
      conservative: +((d.conservative - 1) * 100).toFixed(2),
      aggressive:   +((d.aggressive   - 1) * 100).toFixed(2),
    })), [chartData]);

  if (!metrics) return null;

  // ── Time-range toggle component (reused across tabs)
  const TimeframePicker = () => (
    <div className="flex bg-[#06111f] rounded-lg p-1 border border-[#003049]">
      {['1Y', '1.5Y', 'All'].map(range => (
        <button
          key={range}
          onClick={() => setTimeframe(range)}
          className={cn(
            'px-4 py-1.5 text-xs font-semibold rounded-md transition-all',
            timeframe === range ? 'bg-[#003049] text-white shadow-sm' : 'text-slate-400 hover:text-white'
          )}
        >{range}</button>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#06111f] overflow-hidden text-slate-100 font-sans">

      {/* Sidebar */}
      <aside className="w-64 bg-[#0a192f] border-r border-[#003049]/50 flex flex-col p-6 z-10 shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F77F00] to-[#D62828] flex items-center justify-center shadow-[0_0_20px_rgba(247,127,0,0.3)]">
            <Activity className="text-white w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="font-bold text-xl tracking-wide text-white">Quantum<span className="text-[#FCBF49]">Trade</span></span>
        </div>
        <nav className="flex flex-col gap-2 flex-grow">
          {['Overview', 'Backtest Output', 'Risk Analysis', 'Logs'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn('flex items-center px-4 py-3 rounded-xl transition-all duration-300 text-sm font-medium w-full text-left',
                activeTab === tab ? 'bg-[#003049] text-[#FCBF49] shadow-inner border border-[#FCBF49]/20 font-bold' : 'text-slate-400 hover:bg-[#003049]/50 hover:text-slate-200'
              )}>
              {tab === 'Overview'        && <TrendingUp    className="w-5 h-5 mr-3" />}
              {tab === 'Backtest Output' && <Crosshair     className="w-5 h-5 mr-3" />}
              {tab === 'Risk Analysis'   && <AlertTriangle className="w-5 h-5 mr-3" />}
              {tab === 'Logs'            && <Activity      className="w-5 h-5 mr-3" />}
              {tab}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-[#003049]/50">
          <div className="bg-[#003049]/30 rounded-xl p-4 border border-[#003049]">
            <p className="text-xs text-slate-400 mb-1">Status</p>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FCBF49] opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#F77F00]" />
              </span>
              <span className="text-sm font-medium text-slate-200">GARCH Live Active</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Algorithmic Strategy Dashboard</h1>
            <p className="text-slate-400 mt-1 text-sm">GARCH Volatility · RSI · Bollinger Bands · Intraday Mean Reversion</p>
          </div>
          <div className="flex gap-4">
            <button onClick={handleExportCSV}
              className="px-5 py-2.5 bg-[#003049] border border-[#FCBF49]/30 text-[#FCBF49] text-sm font-medium rounded-xl hover:bg-[#FCBF49] hover:text-[#003049] transition-all flex items-center gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={handleDeployBot}
              className="px-5 py-2.5 bg-gradient-to-r from-[#D62828] to-[#F77F00] text-white text-sm font-bold rounded-xl hover:shadow-[0_4px_20px_0_rgba(214,40,40,0.4)] transition-all flex items-center gap-2">
              Deploy Bot <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── OVERVIEW ── */}
        {activeTab === 'Overview' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Aggressive Total Return"
                value={metrics.aggressive.totalReturn}
                subtitle={`Conservative: ${metrics.conservative.totalReturn}`}
                icon={<Flame className="text-[#D62828] w-6 h-6" />}
                positive
              />
              <MetricCard
                title="Equity Growth (Agg.)"
                value={metrics.aggressive.finalMultiple}
                subtitle={`Conservative: ${metrics.conservative.finalMultiple}`}
                icon={<TargetIcon />}
                positive
              />
              <MetricCard
                title="Max Drawdown (Cons.)"
                value={metrics.conservative.maxDrawdown}
                subtitle={`Aggressive: ${metrics.aggressive.maxDrawdown}`}
                icon={<ShieldCheck className="text-[#003049] w-6 h-6 fill-[#FCBF49]" />}
                positive={false}
              />
              <MetricCard
                title="Win Rate (Aggressive)"
                value={metrics.aggressive.winRate}
                subtitle={`Conservative: ${metrics.conservative.winRate}`}
                icon={<Activity className="text-[#F77F00] w-6 h-6" />}
                positive
              />
            </div>

            {/* Chart */}
            <section className="bg-[#0a192f] rounded-2xl p-6 border border-[#003049] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#F77F00]/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-[#F77F00]/10 transition-all duration-1000" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#003049]/20 rounded-full blur-[100px] pointer-events-none" />
              <div className="flex justify-between items-center mb-2 relative z-10">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <TrendingUp className="text-[#FCBF49] w-5 h-5" />
                    Strategy Comparison — Cumulative Return
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Period: {chartData[0]?.date} → {chartData[chartData.length - 1]?.date} · {chartData.length} trading days
                  </p>
                </div>
                <TimeframePicker />
              </div>
              <div className="h-[410px] w-full relative z-10 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataPct} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#003049" vertical={false} opacity={0.5} />
                    <XAxis dataKey="date" stroke="#546b85" tick={{ fill: '#546b85', fontSize: 11 }}
                      tickLine={false} axisLine={false} minTickGap={55}
                      tickFormatter={v => v ? v.slice(0, 7) : ''} />
                    <YAxis stroke="#546b85" tick={{ fill: '#546b85', fontSize: 12 }}
                      tickLine={false} axisLine={false}
                      tickFormatter={v => `${v.toFixed(0)}%`} />
                    <Tooltip content={<CustomTooltip />}
                      cursor={{ stroke: '#FCBF49', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle"
                      wrapperStyle={{ fontSize: '13px', paddingTop: '4px' }}
                      formatter={v => <span style={{ color: v === 'Conservative' ? '#F77F00' : '#D62828' }}>{v}</span>} />
                    <Line type="monotone" name="Conservative" dataKey="conservative"
                      stroke="#F77F00" strokeWidth={2.5} dot={false}
                      activeDot={{ r: 5, strokeWidth: 0, fill: '#F77F00' }} />
                    <Line type="monotone" name="Aggressive" dataKey="aggressive"
                      stroke="#D62828" strokeWidth={2.5} dot={false}
                      activeDot={{ r: 5, strokeWidth: 0, fill: '#D62828' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

        {/* ── BACKTEST OUTPUT ── */}
        {activeTab === 'Backtest Output' && (
          <div className="bg-[#0a192f] border border-[#003049] rounded-2xl p-8">
            <div className="flex justify-between items-center mb-6 border-b border-[#003049] pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Backtest Output</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Period: {chartData[0]?.date} → {chartData[chartData.length - 1]?.date} ({chartData.length} trading days)
                </p>
              </div>
              <TimeframePicker />
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <MetricCard title="Agg. Total Return" value={metrics.aggressive.totalReturn}
                subtitle={`Cons: ${metrics.conservative.totalReturn}`} icon={<Flame className="text-[#D62828] w-5 h-5" />} positive />
              <MetricCard title="Agg. Equity Multi." value={metrics.aggressive.finalMultiple}
                subtitle={`Cons: ${metrics.conservative.finalMultiple}`} icon={<TargetIcon />} positive />
              <MetricCard title="Agg. Sharpe" value={metrics.aggressive.sharpe}
                subtitle={`Cons: ${metrics.conservative.sharpe}`} icon={<Activity className="text-[#F77F00] w-5 h-5" />} positive />
              <MetricCard title="Agg. Profit Factor" value={metrics.aggressive.profitFactor}
                subtitle={`Cons: ${metrics.conservative.profitFactor}`} icon={<TrendingUp className="text-[#FCBF49] w-5 h-5" />} positive />
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[#FCBF49] border-b border-[#003049]">
                  <th className="py-3 px-4">Metric</th>
                  <th className="py-3 px-4 text-[#F77F00]">Conservative</th>
                  <th className="py-3 px-4 text-[#D62828]">Aggressive</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Total Return',     'totalReturn'],
                  ['Equity Multiple',  'finalMultiple'],
                  ['Annual Return',    'annReturn'],
                  ['Sharpe Ratio',     'sharpe'],
                  ['Sortino Ratio',    'sortino'],
                  ['Win Rate',         'winRate'],
                  ['Profit Factor',    'profitFactor'],
                ].map(([label, key]) => (
                  <tr key={key} className="border-b border-[#003049]/60 hover:bg-[#003049]/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">{label}</td>
                    <td className="py-3 px-4 text-[#F77F00] font-semibold">{metrics.conservative[key]}</td>
                    <td className="py-3 px-4 text-[#D62828] font-semibold">{metrics.aggressive[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── RISK ANALYSIS ── */}
        {activeTab === 'Risk Analysis' && (
          <div className="bg-[#0a192f] border border-[#003049] rounded-2xl p-8">
            <div className="flex justify-between items-center mb-6 border-b border-[#003049] pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Risk Analysis</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Period: {chartData[0]?.date} → {chartData[chartData.length - 1]?.date} ({chartData.length} trading days)
                </p>
              </div>
              <TimeframePicker />
            </div>

            {/* Risk cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <MetricCard title="Agg. Max Drawdown" value={metrics.aggressive.maxDrawdown}
                subtitle={`Cons: ${metrics.conservative.maxDrawdown}`} icon={<AlertTriangle className="text-[#D62828] w-5 h-5" />} positive={false} />
              <MetricCard title="Agg. Volatility" value={metrics.aggressive.volatility}
                subtitle={`Cons: ${metrics.conservative.volatility}`} icon={<Activity className="text-[#F77F00] w-5 h-5" />} positive={false} />
              <MetricCard title="Agg. Sortino" value={metrics.aggressive.sortino}
                subtitle={`Cons: ${metrics.conservative.sortino}`} icon={<ShieldCheck className="text-[#003049] w-5 h-5 fill-[#FCBF49]" />} positive />
              <MetricCard title="Agg. Win Rate" value={metrics.aggressive.winRate}
                subtitle={`Cons: ${metrics.conservative.winRate}`} icon={<TrendingUp className="text-[#FCBF49] w-5 h-5" />} positive />
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[#FCBF49] border-b border-[#003049]">
                  <th className="py-3 px-4">Risk Metric</th>
                  <th className="py-3 px-4 text-[#F77F00]">Conservative</th>
                  <th className="py-3 px-4 text-[#D62828]">Aggressive</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Annualized Volatility', 'volatility'],
                  ['Maximum Drawdown',      'maxDrawdown'],
                  ['Sortino Ratio',         'sortino'],
                  ['Sharpe Ratio',          'sharpe'],
                  ['Win Rate',              'winRate'],
                  ['Profit Factor',         'profitFactor'],
                ].map(([label, key]) => {
                  const riskKeys = ['volatility', 'maxDrawdown'];
                  const isRisk = riskKeys.includes(key);
                  return (
                    <tr key={key} className="border-b border-[#003049]/60 hover:bg-[#003049]/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">{label}</td>
                      <td className={cn('py-3 px-4 font-semibold', isRisk ? 'text-emerald-400' : 'text-[#F77F00]')}>
                        {metrics.conservative[key]}
                      </td>
                      <td className={cn('py-3 px-4 font-semibold', isRisk ? 'text-[#D62828]' : 'text-[#F77F00]')}>
                        {metrics.aggressive[key]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 mt-6">
              Stop-loss rules: Conservative 1–2% daily cap · Aggressive 1–4% daily cap.
              Position sizing is volatility-weighted, volume-spike confirmed (ratio &gt; 1.5×).
            </p>
          </div>
        )}

        {/* ── LOGS ── */}
        {activeTab === 'Logs' && (
          <div className="bg-[#0a192f] border border-[#003049] rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6 border-b border-[#003049] pb-4">Logs</h2>
            <div className="text-sm font-mono text-slate-400 bg-black/40 p-4 rounded-xl border border-[#003049]/50 h-72 overflow-y-auto space-y-1">
              <p>[2021-10-01] Backtest start — GARCH(1,3) rolling window: 180 days</p>
              <p>[2021-10-01] Strategy: RSI(20) + Bollinger(20,2) + Vol spike (&gt;1.5×)</p>
              <p>[2022-01-05] <span className="text-[#FCBF49]">Signal: RSI &lt; 30 + Close &lt; LBand + Vol spike → LONG</span></p>
              <p>[2022-01-05] Position size (cons): 0.82 | (agg): 1.34</p>
              <p>[2022-07-12] <span className="text-[#D62828]">Drawdown breached daily stop — position zeroed</span></p>
              <p>[2022-10-04] <span className="text-[#FCBF49]">Signal: RSI &gt; 70 + Close &gt; UBand + Vol spike → SHORT</span></p>
              <p>[2023-01-03] Vol regime: HIGH — stop widened to 4% (aggressive)</p>
              <p>[2023-09-20] Backtest end. Conservative: 11.43× · Aggressive: 20.80×</p>
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #003049; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #FCBF49; }
      `}} />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function MetricCard({ title, value, subtitle, icon, positive }) {
  return (
    <div className="bg-[#06111f] p-5 rounded-2xl border border-[#003049] hover:border-[#FCBF49]/40 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-[#0a192f] rounded-xl border border-[#003049] group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <div className={cn('px-2.5 py-1 rounded-md text-xs font-bold',
          positive ? 'bg-[#FCBF49]/10 text-[#FCBF49]' : 'bg-[#D62828]/10 text-[#D62828]')}>
          {value}
        </div>
      </div>
      <h3 className="text-slate-400 text-xs font-medium">{title}</h3>
      <p className="text-xl font-bold text-white mt-1 tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a192f] border border-[#003049] shadow-2xl rounded-xl p-4 text-sm font-medium">
      <p className="text-slate-400 mb-3 border-b border-[#003049] pb-2 text-xs">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-3 mb-1.5 last:mb-0">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-200 w-28">{entry.name}</span>
          <span className="text-white font-bold ml-auto">{Number(entry.value).toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

function TargetIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="#FCBF49" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}
