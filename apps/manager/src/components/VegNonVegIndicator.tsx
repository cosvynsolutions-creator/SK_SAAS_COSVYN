import React from 'react';
import { DietType } from '../services/managerStore';

interface IconProps {
  diet: DietType | string;
  size?: number;
  className?: string;
}

/**
 * Standard culinary symbol for Vegetarian (Green square with solid green circle)
 * and Non-Vegetarian (Red/Rose square with solid red triangle).
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

  const strokeColor = isVeg ? '#16a34a' : '#e11d48';
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
        {isVeg ? (
          <circle cx="8" cy="8" r="3.8" fill={fillColor} />
        ) : (
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
