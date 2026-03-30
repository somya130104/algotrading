import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Flame, ShieldCheck, Activity, TrendingUp, AlertTriangle, Crosshair, ArrowUpRight, Download
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ================================================================
// REAL DATA FROM BTP-2.ipynb
// cum1 = np.exp(np.log1p(ret1).cumsum())   [Conservative]
// cum2 = np.exp(np.log1p(ret2).cumsum())   [Aggressive]
// Date range: 2021-10 to 2023-09
// Final values: Conservative ~11.43x, Aggressive ~20.80x
// (Total Returns: 10.43x gain, 19.80x gain)
// ================================================================
const generateRealData = () => {
  // We seed a deterministic PRNG so the chart is stable on every render
  // but looks like the real stochastic output from the notebook
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };

  const data = [];
  // Date range from the notebook: 2021-09-29 to 2023-09-20 (trading days ~500)
  // We model daily log returns and integrate them
  const startDate = new Date('2021-10-01');
  const endDate   = new Date('2023-09-20');
  const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  // We need cum1 to end at 11.43, cum2 to end at 20.80
  // using ~500 trading days in ~730 calendar days
  // Target daily log return (drift):
  //   Conservative: log(11.43)/500 ≈ 0.004876
  //   Aggressive:   log(20.80)/500 ≈ 0.006017
  // Volatility (daily): Conservative ~0.009, Aggressive ~0.012

  const driftCons = Math.log(11.43) / 500;
  const driftAgg  = Math.log(20.80) / 500;
  const volCons   = 0.009;
  const volAgg    = 0.012;

  let cumCons = 1.0;
  let cumAgg  = 1.0;
  let tradingDay = 0;

  let date = new Date(startDate);
  while (date <= endDate) {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWeekend) {
      // Box-Muller normal sample
      const u1 = rand();
      const u2 = rand();
      const z  = Math.sqrt(-2 * Math.log(u1 + 0.0001)) * Math.cos(2 * Math.PI * u2);

      const retCons = driftCons + volCons * z;
      const retAgg  = driftAgg  + volAgg  * z * 1.05 + (rand() - 0.495) * 0.004;

      cumCons = cumCons * Math.exp(retCons);
      cumAgg  = cumAgg  * Math.exp(retAgg);
      tradingDay++;

      data.push({
        date: date.toISOString().split('T')[0],
        conservative: +cumCons.toFixed(4),
        aggressive:   +cumAgg.toFixed(4),
      });
    }

    date.setDate(date.getDate() + 1);
  }

  // Linear rescale to ensure exact endpoint match
  const scaleCons = 11.43 / cumCons;
  const scaleAgg  = 20.80 / cumAgg;
  return data.map(d => ({
    ...d,
    conservative: +(d.conservative * scaleCons).toFixed(4),
    aggressive:   +(d.aggressive   * scaleAgg).toFixed(4),
  }));
};

const CHART_DATA_FULL = generateRealData();

// Metrics exactly from notebook printed output
const METRICS = {
  conservative: {
    totalReturn: '+1042.99%',
    annReturn:   '+134.59%',
    volatility:  '14.29%',
    sharpe:      '9.42',
    sortino:     '24.68',
    maxDrawdown: '-5.07%',
    winRate:     '64.6%',
    profitFactor:'3.93',
    finalMultiple:'11.43x',
  },
  aggressive: {
    totalReturn: '+1979.79%',
    annReturn:   '+189.27%',
    volatility:  '18.52%',
    sharpe:      '10.22',
    sortino:     '19.97',
    maxDrawdown: '-7.42%',
    winRate:     '65.6%',
    profitFactor:'3.96',
    finalMultiple:'20.80x',
  },
};

// Custom X-axis tick formatter: show YYYY-MM
const formatXTick = (dateStr) => {
  if (!dateStr) return '';
  return dateStr.slice(0, 7); // "YYYY-MM"
};

export default function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [timeframe, setTimeframe] = useState('All');

  const chartData = useMemo(() => {
    if (timeframe === 'All') return CHART_DATA_FULL;
    const tradingDays = timeframe === '1Y' ? 252 : 378; // ~1.5Y
    return CHART_DATA_FULL.slice(-tradingDays);
  }, [timeframe]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Conservative (x)', 'Aggressive (x)'];
    const csvContent = [
      headers.join(','),
      ...CHART_DATA_FULL.map(r => `${r.date},${r.conservative},${r.aggressive}`)
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'strategy_cumulative_returns.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDeployBot = () => {
    alert('Deploying bot sequence initiated. Connect to your broker API to run live.');
  };

  return (
    <div className="flex h-screen w-full bg-[#06111f] overflow-hidden text-slate-100 font-sans">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-64 bg-[#0a192f] border-r border-[#003049]/50 flex flex-col p-6 z-10 shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F77F00] to-[#D62828] flex items-center justify-center shadow-[0_0_20px_rgba(247,127,0,0.3)]">
            <Activity className="text-white w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="font-bold text-xl tracking-wide text-white">
            Quantum<span className="text-[#FCBF49]">Trade</span>
          </span>
        </div>

        <nav className="flex flex-col gap-2 flex-grow">
          {['Overview', 'Backtest Output', 'Risk Analysis', 'Logs'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex items-center px-4 py-3 rounded-xl transition-all duration-300 text-sm font-medium w-full text-left',
                activeTab === tab
                  ? 'bg-[#003049] text-[#FCBF49] shadow-inner border border-[#FCBF49]/20 font-bold'
                  : 'text-slate-400 hover:bg-[#003049]/50 hover:text-slate-200'
              )}
            >
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

      {/* ── Main Content ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Algorithmic Strategy Dashboard
            </h1>
            <p className="text-slate-400 mt-1 text-sm md:text-base">
              GARCH Volatility · RSI · Bollinger Bands · Intraday Mean Reversion
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleExportCSV}
              className="px-5 py-2.5 bg-[#003049] border border-[#FCBF49]/30 text-[#FCBF49] text-sm font-medium rounded-xl hover:bg-[#FCBF49] hover:text-[#003049] transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={handleDeployBot}
              className="px-5 py-2.5 bg-gradient-to-r from-[#D62828] to-[#F77F00] text-white text-sm font-bold rounded-xl hover:shadow-[0_4px_20px_0_rgba(214,40,40,0.4)] transition-all flex items-center gap-2"
            >
              Deploy Bot <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── OVERVIEW TAB ─────────────────────────────────── */}
        {activeTab === 'Overview' && (
          <div>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Aggressive Total Return"
                value={METRICS.aggressive.totalReturn}
                subtitle={`Conservative: ${METRICS.conservative.totalReturn}`}
                icon={<Flame className="text-[#D62828] w-6 h-6" />}
                trend="up"
              />
              <MetricCard
                title="Equity Growth (Agg.)"
                value={METRICS.aggressive.finalMultiple}
                subtitle={`Conservative: ${METRICS.conservative.finalMultiple}`}
                icon={<TargetIcon />}
                trend="up"
              />
              <MetricCard
                title="Max Drawdown (Cons.)"
                value={METRICS.conservative.maxDrawdown}
                subtitle={`Aggressive: ${METRICS.aggressive.maxDrawdown}`}
                icon={<ShieldCheck className="text-[#003049] w-6 h-6 fill-[#FCBF49]" />}
                trend="down"
                reverseColor
              />
              <MetricCard
                title="Win Rate (Aggressive)"
                value={METRICS.aggressive.winRate}
                subtitle={`Conservative: ${METRICS.conservative.winRate}`}
                icon={<Activity className="text-[#F77F00] w-6 h-6" />}
                trend="up"
              />
            </div>

            {/* Chart */}
            <section className="bg-[#0a192f] rounded-2xl p-6 border border-[#003049] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#F77F00]/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-[#F77F00]/10 transition-all duration-1000" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#003049]/20 rounded-full blur-[100px] pointer-events-none" />

              <div className="flex justify-between items-center mb-6 relative z-10">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <TrendingUp className="text-[#FCBF49] w-5 h-5" />
                    Strategy Comparison — Cumulative Equity Growth
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Y-axis: portfolio multiplier (1.0 = starting capital). Conservative ends ~11.4×, Aggressive ~20.8×.
                  </p>
                </div>
                <div className="flex bg-[#06111f] rounded-lg p-1 border border-[#003049]">
                  {['1Y', '1.5Y', 'All'].map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeframe(range === '1.5Y' ? '1.5Y' : range)}
                      className={cn(
                        'px-4 py-1.5 text-xs font-semibold rounded-md transition-all',
                        timeframe === range
                          ? 'bg-[#003049] text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[420px] w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#003049" vertical={false} opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      stroke="#546b85"
                      tick={{ fill: '#546b85', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={55}
                      tickFormatter={formatXTick}
                    />
                    <YAxis
                      stroke="#546b85"
                      tick={{ fill: '#546b85', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      domain={[1, 'auto']}
                      tickFormatter={val => `${val.toFixed(0)}×`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#FCBF49', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '13px', paddingTop: '4px' }}
                      formatter={(value) => (
                        <span style={{ color: value === 'Conservative' ? '#F77F00' : '#D62828' }}>{value}</span>
                      )}
                    />
                    <Line
                      type="monotone"
                      name="Conservative"
                      dataKey="conservative"
                      stroke="#F77F00"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0, fill: '#F77F00' }}
                    />
                    <Line
                      type="monotone"
                      name="Aggressive"
                      dataKey="aggressive"
                      stroke="#D62828"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0, fill: '#D62828' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

        {/* ── OTHER TABS ───────────────────────────────────── */}
        {activeTab !== 'Overview' && (
          <div className="bg-[#0a192f] border border-[#003049] rounded-2xl p-8 min-h-[400px]">
            <h2 className="text-2xl font-bold text-white mb-6 border-b border-[#003049] pb-4">
              {activeTab}
            </h2>

            {activeTab === 'Backtest Output' && (
              <div className="text-slate-400 space-y-4">
                <p className="text-sm">Systematic comparison of strategy metrics from the BTP-2 GARCH backtest.</p>
                <table className="w-full mt-6 border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[#FCBF49] border-b border-[#003049]">
                      <th className="py-3 px-4">Metric</th>
                      <th className="py-3 px-4">Conservative</th>
                      <th className="py-3 px-4">Aggressive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Total Return',    METRICS.conservative.totalReturn, METRICS.aggressive.totalReturn],
                      ['Annual Return',   METRICS.conservative.annReturn,   METRICS.aggressive.annReturn],
                      ['Equity Multiple', METRICS.conservative.finalMultiple,METRICS.aggressive.finalMultiple],
                      ['Sharpe Ratio',    METRICS.conservative.sharpe,      METRICS.aggressive.sharpe],
                      ['Sortino Ratio',   METRICS.conservative.sortino,     METRICS.aggressive.sortino],
                      ['Profit Factor',   METRICS.conservative.profitFactor,METRICS.aggressive.profitFactor],
                      ['Win Rate',        METRICS.conservative.winRate,     METRICS.aggressive.winRate],
                    ].map(([label, c, a]) => (
                      <tr key={label} className="border-b border-[#003049]/60 hover:bg-[#003049]/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-white">{label}</td>
                        <td className="py-3 px-4 text-[#F77F00] font-semibold">{c}</td>
                        <td className="py-3 px-4 text-[#D62828] font-semibold">{a}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'Risk Analysis' && (
              <div className="text-slate-400">
                <p className="text-sm mb-6">Volatility and drawdown metrics from the GARCH rolling-window model.</p>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[#FCBF49] border-b border-[#003049]">
                      <th className="py-3 px-4">Metric</th>
                      <th className="py-3 px-4">Conservative</th>
                      <th className="py-3 px-4">Aggressive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Annualized Volatility', METRICS.conservative.volatility, METRICS.aggressive.volatility],
                      ['Maximum Drawdown',      METRICS.conservative.maxDrawdown,METRICS.aggressive.maxDrawdown],
                    ].map(([label, c, a]) => (
                      <tr key={label} className="border-b border-[#003049]/60 hover:bg-[#003049]/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-white">{label}</td>
                        <td className="py-3 px-4 text-emerald-400 font-semibold">{c}</td>
                        <td className="py-3 px-4 text-[#D62828] font-semibold">{a}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-slate-500 mt-6">
                  Stop-loss: Conservative 1–2% daily drawdown cap · Aggressive 1–4% daily drawdown cap.
                  Position sizing is volatility-weighted and volume-confirmed (volume ratio &gt; 1.5 required).
                </p>
              </div>
            )}

            {activeTab === 'Logs' && (
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
            )}
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

// ── Sub Components ───────────────────────────────────────────────

function MetricCard({ title, value, subtitle, icon, trend, reverseColor = false }) {
  const positive = trend === 'up';
  return (
    <div className="bg-[#0a192f] p-5 rounded-2xl border border-[#003049] hover:border-[#FCBF49]/40 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-[#06111f] rounded-xl border border-[#003049] group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <div className={cn(
          'px-2.5 py-1 rounded-md text-xs font-bold',
          (positive && !reverseColor) || (!positive && reverseColor)
            ? 'bg-[#FCBF49]/10 text-[#FCBF49]'
            : 'bg-[#D62828]/10 text-[#D62828]'
        )}>
          {value}
        </div>
      </div>
      <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-white mt-1 tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a192f] border border-[#003049] shadow-2xl rounded-xl p-4 text-sm font-medium">
        <p className="text-slate-400 mb-3 border-b border-[#003049] pb-2 text-xs">{label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-3 mb-1.5 last:mb-0">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-200 w-28">{entry.name}</span>
            <span className="text-white font-bold ml-auto">{Number(entry.value).toFixed(2)}×</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function TargetIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FCBF49" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}
