import React from "react";
import { LearningPath, LearningPathStep, StepStatus } from "../../types";
import { MasteryTierBadge } from "./MasteryTierBadge";
import {
  CheckCircle2,
  Lock,
  PlayCircle,
  ArrowRight,
  Milestone,
  ShieldAlert,
} from "lucide-react";

interface LearningPathStepperProps {
  learningPath: LearningPath | null;
  onSelectStep?: (step: LearningPathStep) => void;
  className?: string;
}

export const LearningPathStepper: React.FC<LearningPathStepperProps> = ({
  learningPath,
  onSelectStep,
  className = "",
}) => {
  if (!learningPath || !learningPath.steps || learningPath.steps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200/80 p-8 text-center space-y-2">
        <Milestone className="w-8 h-8 text-stone-400 mx-auto" />
        <h4 className="text-sm font-bold text-stone-800">
          No Learning Path Generated
        </h4>
        <p className="text-xs text-stone-500 max-w-sm mx-auto">
          Complete a diagnostic assessment to generate an explainable,
          prerequisite-first remediation path.
        </p>
      </div>
    );
  }

  const getStatusDetails = (status: StepStatus) => {
    switch (status) {
      case "COMPLETED":
        return {
          label: "Completed",
          icon: CheckCircle2,
          iconColor: "text-emerald-700 bg-emerald-100 border-emerald-300",
          stepBg: "bg-emerald-50/40 border-emerald-200/80",
          badgeVariant: "emerald",
        };
      case "CURRENT":
        return {
          label: "Current Step",
          icon: PlayCircle,
          iconColor:
            "text-amber-800 bg-amber-100 border-amber-300 ring-2 ring-amber-300/60",
          stepBg: "bg-amber-50/60 border-amber-300 shadow-xs",
          badgeVariant: "amber",
        };
      case "LOCKED":
        return {
          label: "Locked",
          icon: Lock,
          iconColor: "text-stone-500 bg-stone-100 border-stone-300",
          stepBg: "bg-stone-50/60 border-stone-200/70 opacity-90",
          badgeVariant: "stone",
        };
      case "DIAGNOSTIC_REQUIRED":
        return {
          label: "Diagnostic Required",
          icon: ShieldAlert,
          iconColor: "text-sky-700 bg-sky-100 border-sky-300",
          stepBg: "bg-sky-50/50 border-sky-200",
          badgeVariant: "blue",
        };
      case "READY":
      default:
        return {
          label: "Ready",
          icon: PlayCircle,
          iconColor: "text-teal-700 bg-teal-100 border-teal-300",
          stepBg: "bg-teal-50/40 border-teal-200",
          badgeVariant: "teal",
        };
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
            <Milestone className="w-3.5 h-3.5" /> Gated Progression Path
          </div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900 mt-0.5">
            Step-by-Step Remediation Route
          </h2>
          <p className="text-xs text-stone-500">
            Prerequisites are ordered upstream-first. Advance by meeting the{" "}
            <span className="font-semibold text-stone-800">
              70% progression gate
            </span>{" "}
            on each step.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
          <span className="text-stone-500">Total Steps:</span>
          <span className="font-bold text-stone-800">
            {learningPath.steps.length}
          </span>
        </div>
      </div>

      {/* Stepper Steps */}
      <div className="relative space-y-4">
        {learningPath.steps.map((step, index) => {
          const statusConfig = getStatusDetails(step.status);
          const StatusIcon = statusConfig.icon;
          const isLast = index === learningPath.steps.length - 1;
          const masteryScore =
            step.mastery_score ??
            (step.mastery_probability !== null
              ? Math.round(step.mastery_probability * 100)
              : null);
          const isCurrent = step.status === "CURRENT";

          return (
            <div
              key={step.concept_id}
              className="relative flex items-start gap-3 sm:gap-4"
            >
              {/* Timeline Connector Line */}
              {!isLast && (
                <div className="absolute left-5 sm:left-5.5 top-11 bottom-0 w-0.5 -mb-4 bg-stone-200" />
              )}

              {/* Status Circle */}
              <div
                className={`relative z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${statusConfig.iconColor}`}
              >
                <StatusIcon className="w-5 h-5" />
              </div>

              {/* Step Card */}
              <div
                className={`flex-1 rounded-xl border p-4 sm:p-5 transition-all ${statusConfig.stepBg}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-stone-500">
                        Step #{step.position}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                          isCurrent
                            ? "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
                            : "bg-white/80 text-stone-700 border-stone-200"
                        }`}
                      >
                        {statusConfig.label}
                      </span>
                      <MasteryTierBadge
                        tier={step.tier}
                        score={masteryScore}
                        size="sm"
                      />
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-stone-900">
                      {step.label}
                    </h3>
                  </div>

                  {onSelectStep && (
                    <button
                      onClick={() => onSelectStep(step)}
                      disabled={step.status === "LOCKED"}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                        isCurrent
                          ? "bg-amber-700 hover:bg-amber-800 text-white shadow-xs"
                          : step.status === "COMPLETED"
                            ? "bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-stone-200/80 text-stone-500 cursor-not-allowed"
                      }`}
                    >
                      <span>
                        {isCurrent
                          ? "Work on Step"
                          : step.status === "COMPLETED"
                            ? "Review"
                            : "Locked"}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Mastery Progress Bar */}
                <div className="mt-3 pt-3 border-t border-stone-200/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600 font-medium">
                      Current Mastery:{" "}
                      {masteryScore !== null
                        ? `${masteryScore}%`
                        : "Unknown / Diagnostic Needed"}
                    </span>
                    <span className="text-stone-500 font-mono">
                      Gate Target:{" "}
                      {Math.round((step.target_mastery ?? 0.7) * 100)}%
                    </span>
                  </div>

                  <div className="relative w-full bg-stone-200/80 h-2 rounded-full overflow-hidden">
                    {/* Progression Gate Target Marker (70%) */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-stone-500 z-10"
                      style={{
                        left: `${Math.round((step.target_mastery ?? 0.7) * 100)}%`,
                      }}
                      title="Progression Gate (70%)"
                    />

                    {/* Active Mastery Fill */}
                    {masteryScore !== null && (
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          masteryScore >= 70
                            ? "bg-emerald-600"
                            : masteryScore >= 40
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(0, masteryScore))}%`,
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Blocked by Warnings */}
                {step.blocked_by && step.blocked_by.length > 0 && (
                  <div className="mt-2 text-[11px] text-stone-500 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-stone-400 shrink-0" />
                    <span>
                      Blocked until prerequisites are resolved:{" "}
                      <span className="font-mono text-stone-700">
                        {step.blocked_by.length} concept(s)
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
