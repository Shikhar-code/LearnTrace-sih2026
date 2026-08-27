import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: string;
  colorScheme?:
    | "teal"
    | "emerald"
    | "amber"
    | "stone"
    | "indigo"
    | "blue"
    | "rose";
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  colorScheme = "teal",
}) => {
  const iconColors = {
    teal: "bg-teal-50 text-teal-700 border-teal-200/60",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    amber: "bg-amber-50 text-amber-700 border-amber-200/60",
    rose: "bg-rose-50 text-rose-700 border-rose-200/60",
    stone: "bg-stone-100 text-stone-700 border-stone-200/60",
    indigo: "bg-teal-50 text-teal-700 border-teal-200/60",
    blue: "bg-sky-50 text-sky-700 border-sky-200/60",
  };

  return (
    <div className="bg-white border border-stone-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:border-stone-300">
      <div>
        <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
          {title}
        </p>
        <p className="text-2xl font-bold text-stone-900 mt-1 tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>
        )}
        {trend && (
          <p className="text-xs text-emerald-700 font-medium mt-1">{trend}</p>
        )}
      </div>
      {Icon && (
        <div className={`p-2.5 rounded-xl border ${iconColors[colorScheme]}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
};
