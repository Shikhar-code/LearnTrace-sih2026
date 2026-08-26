import React from "react";
import { LearnerProgress } from "../../types";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Award,
  CheckCircle2,
} from "lucide-react";

interface ConceptImprovementCardProps {
  progress: LearnerProgress | null;
  className?: string;
}

export const ConceptImprovementCard: React.FC<ConceptImprovementCardProps> = ({
  progress,
  className = "",
}) => {
  if (
    !progress ||
    (!progress.assessment_scores?.length &&
      !progress.concept_improvement?.length)
  ) {
    return null;
  }

  return (
    <div
      className={`bg-white rounded-xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-5 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" /> Progress Telemetry
          </div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900 mt-0.5">
            Progression & Reassessment Velocity
          </h2>
          <p className="text-xs text-stone-500">
            Historical attempt scores and concept-level mastery delta
            measurements.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-stone-600 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
          <span>Attempts: {progress.assessment_scores.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Assessment Score History */}
        {progress.assessment_scores.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wide flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Assessment Attempts
            </h3>

            <div className="space-y-2">
              {progress.assessment_scores.map((attempt, idx) => (
                <div
                  key={`${attempt.attempt_id}-${idx}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-stone-200 bg-stone-50/50 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-stone-700">
                      Attempt #{attempt.attempt_id}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-white text-stone-600 border border-stone-200 font-mono">
                      {attempt.assessment_type}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-stone-900">
                      Score: {attempt.score}%
                    </span>
                    {attempt.completed && (
                      <span className="text-emerald-700 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3 h-3" /> Completed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Concept Improvement Deltas */}
        {progress.concept_improvement.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Concept Improvement Delta
            </h3>

            <div className="space-y-2">
              {progress.concept_improvement.map((item) => {
                const isPositive = item.change_percentage_points > 0;
                const isZero = item.change_percentage_points === 0;

                return (
                  <div
                    key={item.concept_id}
                    className="flex items-center justify-between p-3 rounded-lg border border-stone-200 bg-stone-50/50 text-xs"
                  >
                    <div className="font-medium text-stone-900">
                      {item.label}
                    </div>

                    <div className="flex items-center gap-1.5 font-mono font-bold">
                      {isPositive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <TrendingUp className="w-3 h-3" />+
                          {item.change_percentage_points}%
                        </span>
                      ) : isZero ? (
                        <span className="inline-flex items-center gap-1 text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                          <Minus className="w-3 h-3" /> 0%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <TrendingDown className="w-3 h-3" />
                          {item.change_percentage_points}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-lg border border-dashed border-stone-200 text-center flex flex-col items-center justify-center space-y-1 text-stone-400 text-xs">
            <Award className="w-5 h-5 text-stone-300" />
            <span>
              Reassessment improvement deltas will appear after completing
              reassessment attempts.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
