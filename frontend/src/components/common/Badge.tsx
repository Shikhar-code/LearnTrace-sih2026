import React from 'react';

export type BadgeVariant = 'stone' | 'teal' | 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' | 'indigo' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  stone: 'bg-stone-100 text-stone-700 border-stone-200/80',
  slate: 'bg-stone-100 text-stone-700 border-stone-200/80',
  teal: 'bg-teal-50 text-teal-800 border-teal-200/70',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/70',
  amber: 'bg-amber-50 text-amber-800 border-amber-200/70',
  rose: 'bg-rose-50 text-rose-800 border-rose-200/70',
  blue: 'bg-sky-50 text-sky-800 border-sky-200/70',
  indigo: 'bg-teal-50 text-teal-800 border-teal-200/70',
  purple: 'bg-purple-50 text-purple-800 border-purple-200/70',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'stone',
  size = 'sm',
  className = '',
}) => {
  const sizeStyles = size === 'sm' ? 'px-2 py-0.5 text-[11px] font-medium' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border ${variantStyles[variant]} ${sizeStyles} ${className}`}
    >
      {children}
    </span>
  );
};
