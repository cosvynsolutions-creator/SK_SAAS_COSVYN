import React from 'react';
import { DietType, PlanDietPreference } from '../services/store';

interface IconProps {
  diet: DietType | string;
  size?: number;
  className?: string;
}

/**
 * Standard culinary symbol for Vegetarian (Green square with solid green circle)
 * and Non-Vegetarian (Red/Rose square with solid red triangle/circle).
 */
export const VegNonVegIcon: React.FC<IconProps> = ({ diet, size = 14, className = '' }) => {
  const norm = String(diet || '').toLowerCase();
  const isVeg = norm === 'veg';
  const isMixed = norm === 'mixed';

  if (isMixed) {
    return (
      <span 
        className={`inline-flex items-center justify-center shrink-0 ${className}`} 
        title="Mixed (Veg & Non-Veg)"
        style={{ width: size, height: size }}
      >
        <svg 
          width={size} 
          height={size} 
          viewBox="0 0 16 16" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <rect 
            x="1.2" 
            y="1.2" 
            width="13.6" 
            height="13.6" 
            rx="3" 
            stroke="#f59e0b" 
            strokeWidth="1.6" 
            fill="#ffffff" 
          />
          <circle cx="5" cy="8" r="2.2" fill="#16a34a" />
          <polygon points="11,5.5 13.5,10.5 8.5,10.5" fill="#e11d48" />
        </svg>
      </span>
    );
  }

  const strokeColor = isVeg ? '#16a34a' : '#e11d48'; // emerald-600 vs rose-600
  const fillColor = isVeg ? '#16a34a' : '#e11d48';

  return (
    <span 
      className={`inline-flex items-center justify-center shrink-0 ${className}`} 
      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
      style={{ width: size, height: size }}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 16 16" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Outer square border */}
        <rect 
          x="1.2" 
          y="1.2" 
          width="13.6" 
          height="13.6" 
          rx="3" 
          stroke={strokeColor} 
          strokeWidth="1.6" 
          fill="#ffffff" 
        />
        {/* Inner solid shape: circle for veg, triangle or solid dot for non-veg */}
        {isVeg ? (
          <circle cx="8" cy="8" r="3.8" fill={fillColor} />
        ) : (
          // Solid triangle for standard Non-Veg mark
          <polygon points="8,3.8 12.4,11.5 3.6,11.5" fill={fillColor} />
        )}
      </svg>
    </span>
  );
};

interface BadgeProps {
  diet: DietType | string;
  count?: number;
  showLabel?: boolean;
  shortLabel?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const VegNonVegBadge: React.FC<BadgeProps> = ({
  diet,
  count,
  showLabel = true,
  shortLabel = false,
  size = 'xs',
  className = ''
}) => {
  const isVeg = String(diet).toLowerCase() === 'veg';

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-2.5 py-1 gap-2'
  }[size];

  const iconSizes = {
    xs: 11,
    sm: 13,
    md: 15
  }[size];

  const labelText = shortLabel 
    ? (isVeg ? 'V' : 'NV') 
    : (isVeg ? 'Veg' : 'Non-Veg');

  return (
    <span
      className={`inline-flex items-center font-bold rounded-md border tracking-tight ${
        isVeg
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90'
          : 'bg-rose-50 text-rose-700 border-rose-200/90'
      } ${sizeClasses} ${className}`}
    >
      <VegNonVegIcon diet={diet} size={iconSizes} />
      {count !== undefined && <span className="font-extrabold">{count}</span>}
      {showLabel && <span>{labelText}</span>}
    </span>
  );
};

interface DayScheduleSelectorProps {
  weekdays: number[]; // allowed delivery days [0..6]
  dayDietSchedule: Record<number, DietType>;
  onChange: (schedule: Record<number, DietType>) => void;
}

const WEEKDAYS = [
  { id: 0, label: 'Sun' },
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
];

/**
 * Interactive day-by-day Veg/Non-Veg toggle directly matching the UI wireframe in Screenshot 1
 */
export const DayDietScheduleSelector: React.FC<DayScheduleSelectorProps> = ({
  weekdays = [1, 2, 3, 4, 5],
  dayDietSchedule = {},
  onChange
}) => {
  const toggleDayDiet = (dayId: number) => {
    const current = dayDietSchedule[dayId] || 'Veg';
    const next: DietType = current === 'Veg' ? 'Non-Veg' : 'Veg';
    onChange({
      ...dayDietSchedule,
      [dayId]: next
    });
  };

  const setAllDays = (diet: DietType) => {
    const updated: Record<number, DietType> = { ...dayDietSchedule };
    weekdays.forEach(d => {
      updated[d] = diet;
    });
    onChange(updated);
  };

  const setMixedPreset = (type: 'alternate' | 'weekends') => {
    const updated: Record<number, DietType> = { ...dayDietSchedule };
    if (type === 'alternate') {
      // Mon, Wed, Fri Non-Veg | Tue, Thu, Sat Veg
      weekdays.forEach(d => {
        updated[d] = (d === 1 || d === 3 || d === 5) ? 'Non-Veg' : 'Veg';
      });
    } else {
      // Sat, Sun Non-Veg, weekdays Veg
      weekdays.forEach(d => {
        updated[d] = (d === 0 || d === 6) ? 'Non-Veg' : 'Veg';
      });
    }
    onChange(updated);
  };

  // Compute stats
  const activeDaysCount = weekdays.length;
  const vegCount = weekdays.filter(d => (dayDietSchedule[d] || 'Veg') === 'Veg').length;
  const nonVegCount = weekdays.filter(d => dayDietSchedule[d] === 'Non-Veg').length;

  return (
    <div className="space-y-2.5 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/90">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span>Veg / Non-Veg Schedule</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
              Per-Day Selection
            </span>
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Click any active day box below to toggle between <span className="text-emerald-700 font-semibold">Veg (Green)</span> and <span className="text-rose-700 font-semibold">Non-Veg (Red)</span>.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAllDays('Veg')}
            className="px-2 py-1 text-[10px] font-bold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
          >
            All Veg
          </button>
          <button
            type="button"
            onClick={() => setAllDays('Non-Veg')}
            className="px-2 py-1 text-[10px] font-bold rounded-lg border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 transition-colors shadow-2xs"
          >
            All Non-Veg
          </button>
          <button
            type="button"
            onClick={() => setMixedPreset('alternate')}
            className="px-2 py-1 text-[10px] font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            title="Mon, Wed, Fri Non-Veg | Tue, Thu, Sat Veg"
          >
            Mixed Days
          </button>
        </div>
      </div>

      {/* Weekday Diet Buttons (Sun to Sat) matching Screenshot 1 hand-drawn wireframe */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map(day => {
          const isActiveWeekday = weekdays.includes(day.id);
          const currentDiet: DietType = dayDietSchedule[day.id] || 'Veg';
          const isVeg = currentDiet === 'Veg';

          if (!isActiveWeekday) {
            return (
              <div
                key={day.id}
                className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-200/60 bg-white/40 text-slate-300 cursor-not-allowed select-none min-h-[58px]"
                title="This day is disabled under Delivery Weekdays"
              >
                <span className="text-[10px] font-bold uppercase">{day.label}</span>
                <span className="text-[9px] text-slate-300 mt-1">Off</span>
              </div>
            );
          }

          return (
            <button
              type="button"
              key={day.id}
              onClick={() => toggleDayDiet(day.id)}
              className={`group flex flex-col items-center justify-between p-2 rounded-xl border-2 transition-all shadow-xs cursor-pointer select-none min-h-[58px] active:scale-95 ${
                isVeg
                  ? 'bg-emerald-50/90 border-emerald-500 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-600'
                  : 'bg-rose-50/90 border-rose-400 text-rose-950 hover:bg-rose-100 hover:border-rose-500'
              }`}
              title={`Click to switch ${day.label} to ${isVeg ? 'Non-Veg' : 'Veg'}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-black uppercase tracking-wider">{day.label}</span>
                <VegNonVegIcon diet={currentDiet} size={13} />
              </div>

              <div className="w-full mt-1.5 text-center">
                <span
                  className={`inline-block w-full py-0.5 rounded text-[10px] font-extrabold uppercase tracking-tight ${
                    isVeg
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-rose-600 text-white shadow-2xs'
                  }`}
                >
                  {isVeg ? 'Veg' : 'N-Veg'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Summary Note */}
      <div className="flex items-center justify-between text-[11px] pt-1 px-1 text-slate-600 font-medium">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>Veg: <strong className="text-emerald-700">{vegCount} days</strong></span>
          <span className="text-slate-300 mx-1">•</span>
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
          <span>Non-Veg: <strong className="text-rose-700">{nonVegCount} days</strong></span>
        </span>
        <span className="text-[10px] text-slate-400 italic">
          {nonVegCount === 0 
            ? 'Pure Veg Plan' 
            : vegCount === 0 
            ? 'Pure Non-Veg Plan' 
            : 'Dual Veg & Non-Veg Plan'}
        </span>
      </div>
    </div>
  );
};
