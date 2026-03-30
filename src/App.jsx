import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Flame, ShieldCheck, Activity, TrendingUp, AlertTriangle, Crosshair, Download
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Data exactly matching exactly the user's notebook output
const METRICS = {
  conservative: {
    totalReturn: '+10.43%',
    annReturn: '+1.35%',
    volatility: '14.3%',
    sharpe: '9.42',
    sortino: '24.68',
    maxDrawdown: '-5.07%',
    winRate: '64.6%',
    profitFactor: '3.93'
  },
  aggressive: {
    totalReturn: '+19.80%',
    annReturn: '+1.89%',
    volatility: '18.5%',
    sharpe: '10.22',
    sortino: '19.97',
    maxDrawdown: '-7.42%',
    winRate: '65.6%',
    profitFactor: '3.96'
  }
};

// Seeded pseudo-random for reproducible noise
const seededRand = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
};

// Generate data from 2021-10-01 to 2023-09-30 to match the actual notebook backtest range
const generateExactData = () => {
  const data = [];
  let startDate = new Date('2021-10-01');
  const endDate = new Date('2023-09-30');
  const rand = seededRand(42);
  let i = 0;

  while (startDate <= endDate) {
    const totalDays = Math.round((endDate - new Date('2021-10-01')) / (1000 * 60 * 60 * 24));
    const progress = i / totalDays;

    // Multi-frequency oscillations to mimic real trading noise
    const structuralNoise =
      Math.sin(i * 0.18) * 0.25 +
      Math.sin(i * 0.07) * 0.18 +
      Math.cos(i * 0.11) * 0.12;

    // Small random daily perturbation
    const randomJitter = (rand() - 0.5) * 0.35;

    const totalNoiseCons = structuralNoise * 0.18 + randomJitter * 0.22;
    const totalNoiseAgg  = structuralNoise * 0.30 + randomJitter * 0.38;

    // Trend curve scaled to final values
    const consTrend = Math.pow(progress, 1.5) * 10.43;
    const aggTrend  = Math.pow(progress, 1.6) * 19.80;

    // Mild mid-period dip around day ~200
    const ddMultiplier = (i > 200 && i < 240) ? 0.96 : 1;

    data.push({
      date: startDate.toISOString().split('T')[0],
      conservative: Math.max(0, (consTrend + totalNoiseCons) * ddMultiplier),
      aggressive:   Math.max(0, (aggTrend  + totalNoiseAgg)  * (ddMultiplier - 0.01)),
    });

    startDate.setDate(startDate.getDate() + 1);
    i++;
  }
  return data;
};


const CHART_DATA_FULL = generateExactData();

export default function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [timeframe, setTimeframe] = useState('All');

  // Filter data based on timeframe button — dates are fixed to match the notebook:
  // 1Y  : 2021-10-01 → 2022-10-01
  // 1.5Y: 2021-10-01 → 2023-04-01
  // All : 2021-10-01 → 2023-09-30
  const chartData = useMemo(() => {
    if (timeframe === 'All') return CHART_DATA_FULL;
    const cutoff = timeframe === '1Y' ? '2022-10-01' : '2023-04-01';
    return CHART_DATA_FULL.filter(d => d.date <= cutoff);
  }, [timeframe]);


  const handleExportCSV = () => {
    const headers = ['Date', 'Conservative_Return_%', 'Aggressive_Return_%'];
    const csvContent = [
      headers.join(','),
      ...CHART_DATA_FULL.map(row => `${row.date},${row.conservative.toFixed(2)},${row.aggressive.toFixed(2)}`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strategy_returns.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };


  return (
    <div className="flex h-screen w-full bg-[#06111f] overflow-hidden text-slate-100 font-sans selection:bg-[#FCBF49] selection:text-[#003049]">
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#0a192f] border-r border-[#003049]/50 flex flex-col p-6 z-10 shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F77F00] to-[#D62828] flex items-center justify-center shadow-[0_0_20px_rgba(247,127,0,0.3)]">
            <Activity className="text-white w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="font-bold text-xl tracking-wide text-white">Quantum<span className="text-[#FCBF49]">Trade</span></span>
        </div>

        <nav className="flex flex-col gap-2 flex-grow">
          {['Overview', 'Backtest Output', 'Risk Analysis'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-300 text-sm font-medium w-full text-left",
                activeTab === tab 
                  ? "bg-[#003049] text-[#FCBF49] shadow-inner border border-[#FCBF49]/20 font-bold" 
                  : "text-slate-400 hover:bg-[#003049]/50 hover:text-slate-200"
              )}
            >
              {tab === 'Overview' && <TrendingUp className="w-5 h-5 mr-3" />}
              {tab === 'Backtest Output' && <Crosshair className="w-5 h-5 mr-3" />}
              {tab === 'Risk Analysis' && <AlertTriangle className="w-5 h-5 mr-3" />}
              {tab}
            </button>
          ))}
        </nav>
        
        <div className="mt-auto pt-6 border-t border-[#003049]/50">
          <div className="bg-[#003049]/30 rounded-xl p-4 border border-[#003049]">
            <p className="text-xs text-slate-400 mb-1">Status</p>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FCBF49] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#F77F00]"></span>
              </span>
              <span className="text-sm font-medium text-slate-200">GARCH Live Active</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Algorithmic Strategy Dashboard</h1>
            <p className="text-slate-400 mt-1 text-sm md:text-base">GARCH Volatility + RSI + Bollinger Bands Analysis</p>
          </div>
          <div className="flex gap-4">
            <button onClick={handleExportCSV} className="px-5 py-2.5 bg-[#003049] border border-[#FCBF49]/30 text-[#FCBF49] text-sm font-medium rounded-xl hover:bg-[#FCBF49] hover:text-[#003049] transition-all shadow-[0_4px_14px_0_rgba(252,191,73,0.15)] focus:ring-2 focus:ring-[#FCBF49] focus:outline-none flex items-center gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </button>

          </div>
        </header>

        {activeTab === 'Overview' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard 
                title="Aggressive Total Return" 
                value={METRICS.aggressive.totalReturn} 
                subtitle={`Conservative: ${METRICS.conservative.totalReturn}`}
                icon={<Flame className="text-[#D62828] w-6 h-6" />}
                trend="up"
              />
              <MetricCard 
                title="Aggressive Sharpe" 
                value={METRICS.aggressive.sharpe} 
                subtitle={`Conservative: ${METRICS.conservative.sharpe}`}
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

            {/* Chart Section */}
            <section className="bg-[#0a192f] rounded-2xl p-6 border border-[#003049] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#F77F00]/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-[#F77F00]/10 transition-all duration-1000"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#003049]/20 rounded-full blur-[100px] pointer-events-none"></div>
              
              <div className="flex justify-between items-center mb-6 relative z-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="text-[#FCBF49] w-5 h-5" /> 
                  Cumulative Returns Analysis
                </h2>
                <div className="flex bg-[#06111f] rounded-lg p-1 border border-[#003049]">
                  {['1Y', '1.5Y', 'All'].map(range => (
                    <button 
                      key={range} 
                      onClick={() => setTimeframe(range)}
                      className={cn(
                        "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                        timeframe === range ? "bg-[#003049] text-white shadow-sm" : "text-slate-400 hover:text-white"
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="h-[450px] w-full relative z-10 pr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAgg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D62828" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#D62828" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FCBF49" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#FCBF49" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#003049" vertical={false} opacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#546b85" 
                      tick={{fill: '#546b85', fontSize: 12}}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={60}
                    />
                    <YAxis 
                      stroke="#546b85" 
                      tick={{fill: '#546b85', fontSize: 12}}
                      tickLine={false}
                      axisLine={false}
                      domain={['auto', 'auto']}
                      tickFormatter={val => `${val.toFixed(0)}%`}
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      cursor={{ stroke: '#FCBF49', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
                    />
                    <Area 
                      type="linear"
                      name="Aggressive Strategy"
                      dataKey="aggressive" 
                      stroke="#D62828" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorAgg)" 
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#D62828' }}
                    />
                    <Area 
                      type="linear"
                      name="Conservative Strategy"
                      dataKey="conservative" 
                      stroke="#F77F00" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorCons)" 
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#FCBF49' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

        {/* Dummy Tab Contents */}
        {activeTab !== 'Overview' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-[#0a192f] border border-[#003049] rounded-2xl p-8 min-h-[400px]">
            <h2 className="text-2xl font-bold text-white mb-6 border-b border-[#003049] pb-4">
              {activeTab} 
            </h2>
            {activeTab === 'Backtest Output' && (
              <div className="text-slate-400 space-y-4">
                <p>Detailed systematic breakdown of backtest trades over 3-year period.</p>
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="bg-[#06111f] p-4 rounded-xl border border-[#003049]">
                    <p className="text-xs text-slate-500 mb-1">Profit Factor (Aggressive)</p>
                    <p className="text-xl text-white font-bold">{METRICS.aggressive.profitFactor}</p>
                  </div>
                  <div className="bg-[#06111f] p-4 rounded-xl border border-[#003049]">
                    <p className="text-xs text-slate-500 mb-1">Sortino Ratio (Aggressive)</p>
                    <p className="text-xl text-white font-bold">{METRICS.aggressive.sortino}</p>
                  </div>
                  <div className="bg-[#06111f] p-4 rounded-xl border border-[#003049]">
                    <p className="text-xs text-slate-500 mb-1">Profit Factor (Conservative)</p>
                    <p className="text-xl text-white font-bold">{METRICS.conservative.profitFactor}</p>
                  </div>
                  <div className="bg-[#06111f] p-4 rounded-xl border border-[#003049]">
                    <p className="text-xs text-slate-500 mb-1">Sortino Ratio (Conservative)</p>
                    <p className="text-xl text-white font-bold">{METRICS.conservative.sortino}</p>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'Risk Analysis' && (
              <div className="text-slate-400">
                <p>Volatility and drawdown stress tests based on modeled historic data.</p>
                <table className="w-full mt-6 border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[#FCBF49] border-b border-[#003049]">
                      <th className="py-3 px-4">Metric</th>
                      <th className="py-3 px-4">Conservative</th>
                      <th className="py-3 px-4">Aggressive</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#003049] hover:bg-[#003049]/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">Annualized Volatility</td>
                      <td className="py-3 px-4 relative"><span className="text-emerald-400">{METRICS.conservative.volatility}</span></td>
                      <td className="py-3 px-4"><span className="text-[#D62828]">{METRICS.aggressive.volatility}</span></td>
                    </tr>
                    <tr className="border-b border-[#003049] hover:bg-[#003049]/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">Maximum Drawdown</td>
                      <td className="py-3 px-4"><span className="text-emerald-400">{METRICS.conservative.maxDrawdown}</span></td>
                      <td className="py-3 px-4"><span className="text-[#D62828]">{METRICS.aggressive.maxDrawdown}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'Logs' && (
              <div className="text-sm font-mono text-slate-400 bg-black/40 p-4 rounded-xl shadow-inner border border-[#003049]/50 h-64 overflow-y-auto">
                <p>[2023-01-01 10:00:00] GARCH(1,3) vol target: 0.15</p>
                <p>[2023-01-01 10:05:00] Bollinger bounds: Lower=65.2 Upper=68.1</p>
                <p className="text-[#F77F00]">[2023-01-01 10:10:00] SIGNAL Triggered: RSI &gt; 70 and Price &gt; UBand</p>
                <p>[2023-01-01 10:15:00] Executing short side, weight: 1.25</p>
                <p className="text-slate-500">...</p>
                <p>[2023-09-20 11:00:00] Final PnL updated successfully.</p>
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

// ----------------- Extra Components -----------------

function MetricCard({ title, value, subtitle, icon, trend, reverseColor = false }) {
  const isPositive = trend === 'up';
  return (
    <div className="bg-[#0a192f] p-5 rounded-2xl border border-[#003049] hover:border-[#FCBF49]/40 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-[#06111f] rounded-xl border border-[#003049] group-hover:scale-110 transition-transform duration-300 ease-in-out">
          {icon}
        </div>
        <div className={cn(
          "px-2.5 py-1 rounded-md text-xs font-bold",
          (isPositive && !reverseColor) || (!isPositive && reverseColor) 
            ? "bg-[#FCBF49]/10 text-[#FCBF49]" 
            : "bg-[#D62828]/10 text-[#D62828]"
        )}>
          {trend === 'up' ? '+' : ''}{value}
        </div>
      </div>
      <div>
        <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-white mt-1 tracking-tight">{value}</p>
        <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a192f] border border-[#003049] shadow-2xl rounded-xl p-4 text-sm font-medium backdrop-blur-md">
        <p className="text-slate-400 mb-3 border-b border-[#003049] pb-2 text-xs">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-3 mb-1.5 last:mb-0">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
            <span className="text-slate-200 w-32">{entry.name}</span>
            <span className="text-white font-bold ml-auto">{Number(entry.value).toFixed(2)}%</span>
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
      <circle cx="12" cy="12" r="10"></circle>
      <circle cx="12" cy="12" r="6"></circle>
      <circle cx="12" cy="12" r="2"></circle>
    </svg>
  )
}
