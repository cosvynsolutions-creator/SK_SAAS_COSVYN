import React, { useState } from 'react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip 
} from 'recharts';

export interface DonutDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface GlassmorphicDonutChartProps {
  data: DonutDataPoint[];
  title?: string;
  subtitle?: string;
  centerValue?: string;
  centerLabel?: string;
  isCurrency?: boolean;
  currencySymbol?: string;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}

// Vibrant modern gradient stops
const GRADIENTS = [
  { id: 'grad-0', from: '#3b82f6', to: '#1d4ed8' }, // Electric Blue
  { id: 'grad-1', from: '#8b5cf6', to: '#6d28d9' }, // Violet
  { id: 'grad-2', from: '#10b981', to: '#059669' }, // Emerald
  { id: 'grad-3', from: '#f59e0b', to: '#d97706' }, // Amber
  { id: 'grad-4', from: '#f43f5e', to: '#e11d48' }, // Rose
  { id: 'grad-5', from: '#06b6d4', to: '#0891b2' }, // Cyan
  { id: 'grad-6', from: '#ec4899', to: '#be185d' }, // Pink
  { id: 'grad-7', from: '#6366f1', to: '#4338ca' }, // Indigo
];

export const GlassmorphicDonutChart: React.FC<GlassmorphicDonutChartProps> = ({
  data,
  title,
  subtitle,
  centerValue,
  centerLabel,
  isCurrency = true,
  currencySymbol = '₹',
  height = 320,
  innerRadius = 68,
  outerRadius = 96
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const total = data.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  const displayCenterValue = centerValue !== undefined 
    ? centerValue 
    : isCurrency 
    ? `${currencySymbol}${Math.round(total).toLocaleString()}` 
    : total.toLocaleString();

  const displayCenterLabel = centerLabel || 'Total';

  return (
    <div className="flex flex-col h-full select-none">
      
      {/* Chart Canvas with Centered Hole Metric */}
      <div className="relative flex-1" style={{ minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {GRADIENTS.map((g, i) => (
                <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={g.from} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={g.to} stopOpacity={0.8} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={4}
              dataKey="value"
              animationDuration={800}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((entry, index) => {
                const gradId = `url(#${GRADIENTS[index % GRADIENTS.length].id})`;
                const isHovered = activeIndex === index;

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || gradId}
                    stroke="rgba(255, 255, 255, 0.9)"
                    strokeWidth={isHovered ? 3 : 2}
                    className="transition-all duration-200 cursor-pointer outline-none"
                    style={{
                      filter: isHovered 
                        ? 'drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.22)) scale(1.03)' 
                        : 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.08))',
                      transformOrigin: 'center center'
                    }}
                  />
                );
              })}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0];
                  const val = Number(item.value) || 0;
                  const percent = total > 0 ? ((val / total) * 100).toFixed(1) : '0';

                  return (
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-white/20 text-white px-3.5 py-2.5 rounded-2xl shadow-glass-xl text-xs space-y-1 animate-in zoom-in-95 duration-150">
                      <div className="flex items-center gap-1.5 font-bold font-display text-white">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: item.payload?.color || GRADIENTS[data.findIndex(d => d.name === item.name) % GRADIENTS.length]?.from || '#3b82f6' }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 pt-0.5">
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {isCurrency ? `${currencySymbol}${val.toLocaleString()}` : val.toLocaleString()}
                        </span>
                        <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-300">
                          {percent}%
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Centered Donut Metric Card */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {displayCenterLabel}
          </span>
          <span className="text-xl sm:text-2xl font-black font-display text-slate-900 tracking-tight leading-tight mt-0.5">
            {displayCenterValue}
          </span>
          <span className="text-[10px] font-medium text-slate-400">
            {data.length} {data.length === 1 ? 'Category' : 'Categories'}
          </span>
        </div>
      </div>

      {/* Styled Interactive Legend Pills Below */}
      <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/80">
        {data.slice(0, 6).map((item, idx) => {
          const val = Number(item.value) || 0;
          const percent = total > 0 ? Math.round((val / total) * 100) : 0;
          const grad = GRADIENTS[idx % GRADIENTS.length];
          const isSelected = activeIndex === idx;

          return (
            <div
              key={idx}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isSelected 
                  ? 'bg-slate-50 border-slate-300 shadow-xs scale-[1.02]' 
                  : 'bg-white/70 border-slate-100 hover:bg-slate-50/70'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span 
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                  style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }} 
                />
                <span className="text-xs font-semibold text-slate-700 truncate" title={item.name}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-bold font-mono text-slate-900">
                  {isCurrency ? `${currencySymbol}${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}` : val}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                  {percent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
