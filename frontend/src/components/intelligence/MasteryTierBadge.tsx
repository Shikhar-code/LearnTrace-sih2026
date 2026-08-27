import React from "react";
import { MasteryTier } from "../../types";
import {
  AlertCircle,
  CheckCircle2,
  Award,
  Clock,
  HelpCircle,
  Flame,
} from "lucide-react";

interface MasteryTierBadgeProps {
  tier: MasteryTier | string | null;
  score?: number | null;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export const normalizeTier = (
  tier: MasteryTier | string | null,
): MasteryTier => {
  if (!tier) return "UNKNOWN";
  const normalized = tier.toUpperCase().replace(/\s+/g, "_");
  if (normalized.includes("CRITICAL")) return "CRITICAL_GAP";
  if (normalized.includes("EMERG")) return "EMERGING";
  if (normalized.includes("DEVELOP")) return "DEVELOPING";
  if (normalized.includes("PROFICIENT")) return "PROFICIENT";
  if (normalized.includes("MASTER")) return "MASTERED";
  return "UNKNOWN";
};

export const getTierDetails = (tierKey: MasteryTier) => {
  switch (tierKey) {
    case "CRITICAL_GAP":
      return {
        label: "Critical Gap",
        range: "0–39%",
        bg: "bg-rose-50 text-rose-800 border-rose-200/80",
        dotBg: "bg-rose-500",
        borderColor: "border-rose-500",
        icon: AlertCircle,
      };
    case "EMERGING":
      return {
        label: "Emerging",
        range: "40–54%",
        bg: "bg-amber-50 text-amber-800 border-amber-200/80",
        dotBg: "bg-amber-500",
        borderColor: "border-amber-500",
        icon: Clock,
      };
    case "DEVELOPING":
      return {
        label: "Developing",
        range: "55–69%",
        bg: "bg-sky-50 text-sky-800 border-sky-200/80",
        dotBg: "bg-sky-500",
        borderColor: "border-sky-500",
        icon: Flame,
      };
    case "PROFICIENT":
      return {
        label: "Proficient",
        range: "70–84%",
        bg: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
        dotBg: "bg-emerald-500",
        borderColor: "border-emerald-500",
        icon: CheckCircle2,
      };
    case "MASTERED":
      return {
        label: "Mastered",
        range: "85–100%",
        bg: "bg-teal-50 text-teal-800 border-teal-200/80",
        dotBg: "bg-teal-600",
        borderColor: "border-teal-600",
        icon: Award,
      };
    case "UNKNOWN":
    default:
      return {
        label: "Unknown",
        range: "No data",
        bg: "bg-stone-100 text-stone-600 border-stone-200/80",
        dotBg: "bg-stone-400",
        borderColor: "border-stone-300",
        icon: HelpCircle,
      };
  }
};

export const MasteryTierBadge: React.FC<MasteryTierBadgeProps> = ({
  tier,
  score,
  size = "sm",
  showIcon = true,
  className = "",
}) => {
  const tierKey = normalizeTier(tier);
  const details = getTierDetails(tierKey);
  const Icon = details.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium ${details.bg} ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <Icon className={size === "lg" ? "w-4 h-4" : "w-3 h-3"} />}
      <span>{details.label}</span>
      {score !== undefined && score !== null && (
        <span className="font-mono opacity-80 font-bold ml-0.5">
          ({score}%)
        </span>
      )}
    </span>
  );
};
