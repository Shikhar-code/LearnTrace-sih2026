import React from "react";
import { NextAction } from "../../types";
import {
  Compass,
  ArrowRight,
  Stethoscope,
  Sparkles,
  RotateCw,
  BookOpen,
} from "lucide-react";

interface NextActionCardProps {
  action: NextAction;
  readinessScore?: number | null;
  rootGapProbability?: number | null;
  onActionClick?: (action: NextAction) => void;
  className?: string;
}

export const NextActionCard: React.FC<NextActionCardProps> = ({
  action,
  readinessScore,
  rootGapProbability,
  onActionClick,
  className = "",
}) => {
  const getActionConfig = () => {
    switch (action.type) {
      case "LEARN_CURRENT_STEP":
        return {
          title: "Remediate Prerequisite",
          badge: "Recommended Action",
          description: `Focus on mastering "${action.label}" first to unblock dependent concepts in your learning path.`,
          buttonLabel: "Learn Prerequisite Now",
          icon: BookOpen,
          bgGradient:
            "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-300/80",
          badgeColor: "bg-amber-100 text-amber-900 border-amber-300",
          buttonColor: "bg-amber-700 hover:bg-amber-800 text-white",
        };
      case "TAKE_DIAGNOSTIC":
        return {
          title: "Diagnostic Required",
          badge: "Evidence Needed",
          description: `Additional assessment evidence is required for "${action.label}" to accurately verify prerequisite readiness.`,
          buttonLabel: "Take Diagnostic Quiz",
          icon: Stethoscope,
          bgGradient:
            "bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent border-sky-300/80",
          badgeColor: "bg-sky-100 text-sky-900 border-sky-300",
          buttonColor: "bg-sky-700 hover:bg-sky-800 text-white",
        };
      case "MAINTAIN_MASTERY":
        return {
          title: "Mastery Achieved",
          badge: "Goal Met",
          description: `You have demonstrated strong proficiency in "${action.label}". Keep your skills sharp with periodic practice.`,
          buttonLabel: "Practice & Retain",
          icon: Sparkles,
          bgGradient:
            "bg-gradient-to-r from-teal-500/10 via-teal-500/5 to-transparent border-teal-300/80",
          badgeColor: "bg-teal-100 text-teal-900 border-teal-300",
          buttonColor: "bg-teal-800 hover:bg-teal-900 text-white",
        };
      case "REVIEW_TARGET":
      default:
        return {
          title: "Target Practice",
          badge: "Next Step",
          description: `Continue working directly on the target concept "${action.label}" to reach the 70% progression gate.`,
          buttonLabel: "Practice Target",
          icon: RotateCw,
          bgGradient:
            "bg-gradient-to-r from-stone-500/10 via-stone-500/5 to-transparent border-stone-300/80",
          badgeColor: "bg-stone-100 text-stone-900 border-stone-300",
          buttonColor: "bg-stone-800 hover:bg-stone-900 text-white",
        };
    }
  };

  const config = getActionConfig();
  const Icon = config.icon;

  return (
    <div
      className={`bg-white rounded-xl border p-5 sm:p-6 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5 ${config.bgGradient} ${className}`}
    >
      <div className="space-y-2 max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${config.badgeColor}`}
          >
            <Compass className="w-3 h-3" />
            {config.badge}
          </span>
          {readinessScore !== undefined && readinessScore !== null && (
            <span className="text-[11px] text-stone-500 font-medium">
              Readiness Index:{" "}
              <strong className="font-mono text-stone-800">
                {readinessScore}%
              </strong>
            </span>
          )}
          {rootGapProbability !== undefined &&
            rootGapProbability !== null &&
            rootGapProbability > 0 && (
              <span className="text-[11px] text-stone-500 font-medium">
                Gap Likelihood:{" "}
                <strong className="font-mono text-stone-800">
                  {Math.round(rootGapProbability * 100)}%
                </strong>
              </span>
            )}
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <Icon className="w-4 h-4 text-stone-700 shrink-0" />
            {config.title}:{" "}
            <span className="text-teal-900">{action.label}</span>
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
            {config.description}
          </p>
        </div>
      </div>

      <div className="shrink-0 flex items-center">
        <button
          onClick={() => onActionClick?.(action)}
          className={`w-full md:w-auto px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center justify-center gap-2 ${config.buttonColor}`}
        >
          <span>{config.buttonLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
