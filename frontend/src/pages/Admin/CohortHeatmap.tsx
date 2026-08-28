import React, { useEffect, useState, useMemo } from "react";
import {
  intelligenceApi,
  assessmentApi,
  getApiErrorMessage,
} from "../../services/api";
import { getAllCohortAttemptIds } from "../../services/attemptStorage";
import {
  AdminHeatmapPayload,
  AttemptAnalysisInput,
  AdminHeatmapCell,
} from "../../types";
import { StatCard } from "../../components/common/StatCard";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { AlertBanner } from "../../components/common/AlertBanner";
import { MasteryTierBadge } from "../../components/intelligence/MasteryTierBadge";
import {
  Users,
  Layers,
  Award,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  Grid,
  TrendingDown,
  Sparkles,
} from "lucide-react";

const SUBJECT_OPTIONS = [
  {
    classLevel: 10,
    subject: "Mathematics",
    label: "Class 10 — Mathematics",
    defaultTarget: "class-10:mathematics:some-applications-of-trigonometry",
  },
  {
    classLevel: 10,
    subject: "Science",
    label: "Class 10 — Science",
    defaultTarget: "class-10:science:chemical-reactions-and-equations",
  },
  {
    classLevel: 9,
    subject: "Mathematics",
    label: "Class 9 — Mathematics",
    defaultTarget: "class-9:mathematics:the-world-of-numbers",
  },
  {
    classLevel: 9,
    subject: "Science",
    label: "Class 9 — Science",
    defaultTarget: "class-9:science:cell-the-building-block-of-life",
  },
];

// Baseline attempts for cohort analysis
const DEFAULT_COHORT_ATTEMPTS: AttemptAnalysisInput[] = [
  { attempt_id: 1, assessment_type: "diagnostic" },
  { attempt_id: 4, assessment_type: "reassessment" },
  { attempt_id: 2, assessment_type: "diagnostic" },
  { attempt_id: 3, assessment_type: "diagnostic" },
];

export const CohortHeatmap: React.FC = () => {
  const [selectedSubjectIdx, setSelectedSubjectIdx] = useState<number>(0);
  const [attemptIdsInput, setAttemptIdsInput] = useState<string>("1, 2, 3, 4");
  const [heatmapData, setHeatmapData] = useState<AdminHeatmapPayload | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [discoveredCount, setDiscoveredCount] = useState<number>(4);
  const [activeCellDetail, setActiveCellDetail] = useState<{
    studentId: number;
    conceptLabel: string;
    cell: AdminHeatmapCell;
  } | null>(null);

  const activeSubject = SUBJECT_OPTIONS[selectedSubjectIdx];

  const parseAttemptInputs = (idsString: string): AttemptAnalysisInput[] => {
    const ids = idsString
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);

    if (ids.length === 0) return DEFAULT_COHORT_ATTEMPTS;
    return ids.map((id) => ({
      attempt_id: id,
      assessment_type: id === 4 ? "reassessment" : "diagnostic",
    }));
  };

  const loadHeatmap = async (overrideAttempts?: AttemptAnalysisInput[]) => {
    setLoading(true);
    setErrorMessage(null);
    setActiveCellDetail(null);

    const attempts = overrideAttempts || parseAttemptInputs(attemptIdsInput);

    try {
      const data = await intelligenceApi.getAdminHeatmap(
        attempts,
        activeSubject.defaultTarget,
      );
      setHeatmapData(data);
    } catch (err) {
      console.warn(
        "Failed to load admin cohort heatmap with supplied IDs, attempting auto-discovery:",
        err,
      );
      try {
        // Fallback to backend auto-discovery
        const fallbackData = await intelligenceApi.getAdminHeatmap(
          [],
          activeSubject.defaultTarget,
        );
        setHeatmapData(fallbackData);
      } catch (fallbackErr) {
        setErrorMessage(
          `Unable to generate cohort heatmap for ${activeSubject.label}. ${getApiErrorMessage(fallbackErr)}`,
        );
        setHeatmapData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Synchronize attempts & execute single clean load on subject switch
  useEffect(() => {
    let isCancelled = false;

    const syncAndLoad = async () => {
      const storedIds = getAllCohortAttemptIds();
      let dbIds: number[] = [];
      try {
        const dbAttempts = await assessmentApi.listCompletedAttempts({
          class_level: activeSubject.classLevel,
        });
        dbIds = dbAttempts.map((a) => a.attempt_id);
      } catch {
        // Backend offline fallback
      }

      if (isCancelled) return;

      const merged = Array.from(
        new Set([...storedIds, ...dbIds, 1, 2, 3, 4]),
      ).sort((a, b) => a - b);

      const mergedString = merged.join(", ");
      setAttemptIdsInput(mergedString);
      setDiscoveredCount(merged.length);

      const parsed = parseAttemptInputs(mergedString);
      loadHeatmap(parsed);
    };

    syncAndLoad();

    return () => {
      isCancelled = true;
    };
  }, [selectedSubjectIdx]);

  // Color mapper for heatmap cells
  const getCellStyles = (cell: AdminHeatmapCell) => {
    if (!cell.assessed || cell.mastery_score === null) {
      return {
        bg: "bg-stone-100/80",
        border: "border-stone-200",
        text: "text-stone-400 font-mono",
        badge: "Unassessed",
      };
    }

    if (cell.is_root_gap) {
      return {
        bg: "bg-rose-100/90",
        border: "border-rose-400 ring-1 ring-rose-400",
        text: "text-rose-900 font-bold",
        badge: "Root Gap",
      };
    }

    switch (cell.tier) {
      case "MASTERED":
        return {
          bg: "bg-emerald-100/90",
          border: "border-emerald-300",
          text: "text-emerald-900 font-bold",
          badge: "Mastered",
        };
      case "PROFICIENT":
        return {
          bg: "bg-teal-100/90",
          border: "border-teal-300",
          text: "text-teal-900 font-bold",
          badge: "Proficient",
        };
      case "DEVELOPING":
        return {
          bg: "bg-amber-100/90",
          border: "border-amber-300",
          text: "text-amber-900 font-bold",
          badge: "Developing",
        };
      case "EMERGING":
        return {
          bg: "bg-orange-100/90",
          border: "border-orange-300",
          text: "text-orange-900 font-bold",
          badge: "Emerging",
        };
      case "CRITICAL_GAP":
      default:
        return {
          bg: "bg-rose-100/90",
          border: "border-rose-300",
          text: "text-rose-900 font-bold",
          badge: "Critical Gap",
        };
    }
  };

  // Cell lookup map for columns per row
  const cellMap = useMemo(() => {
    if (!heatmapData?.rows) return new Map<string, AdminHeatmapCell>();
    const map = new Map<string, AdminHeatmapCell>();
    heatmapData.rows.forEach((row) => {
      row.cells.forEach((cell) => {
        map.set(`${row.user_id}-${cell.concept_id}`, cell);
      });
    });
    return map;
  }, [heatmapData]);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full pb-16">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-700 font-semibold text-[11px] uppercase tracking-wider">
              <Grid className="w-3.5 h-3.5" /> Class Mastery & Pedagogical
              Matrix
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              Cohort Mastery Heatmap
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Multi-student concept mastery matrix, root-cause bottleneck
              distribution, and class-level intervention planning.
            </p>
          </div>

          {/* Controls: Attempt IDs and Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Synced Badge */}
            <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-200/80 px-2.5 py-1 rounded-lg text-xs">
              <Sparkles className="w-3.5 h-3.5 text-teal-800" />
              <span className="font-semibold text-teal-900">
                {discoveredCount} Attempts Live
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-stone-100/80 p-1.5 rounded-lg border border-stone-200/80 text-xs">
              <span className="font-medium text-stone-600 px-1 text-[11px]">
                Attempts:
              </span>
              <input
                type="text"
                value={attemptIdsInput}
                onChange={(e) => setAttemptIdsInput(e.target.value)}
                placeholder="1, 2, 3"
                className="w-28 px-2 py-1 bg-white border border-stone-300 rounded font-mono text-center font-bold text-stone-800 text-xs"
                title="Comma-separated Attempt IDs to include in cohort analysis"
              />
            </div>

            <button
              onClick={() => loadHeatmap()}
              className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Analyze Cohort</span>
            </button>
          </div>
        </div>

        {/* Subject Switcher Tabs */}
        <div className="mt-5 pt-4 border-t border-stone-100 flex items-center gap-2 overflow-x-auto pb-1">
          {SUBJECT_OPTIONS.map((sub, idx) => {
            const isSelected = selectedSubjectIdx === idx;
            return (
              <button
                key={sub.label}
                onClick={() => setSelectedSubjectIdx(idx)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  isSelected
                    ? "bg-amber-800 text-white shadow-xs"
                    : "bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200/80"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{sub.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <AlertBanner
          type="error"
          title="Notice"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {loading ? (
        <div className="bg-white p-14 rounded-xl border border-stone-200/80 text-center shadow-xs">
          <LoadingSpinner
            label={`Aggregating cohort mastery telemetry for ${activeSubject.label}...`}
          />
        </div>
      ) : !heatmapData ? (
        <div className="bg-white p-12 rounded-xl border border-stone-200/80 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-stone-800 text-sm">
            No Cohort Telemetry Available
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Complete student diagnostic attempts in this subject scope to
            populate the cohort mastery heatmap.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Cohort Size"
              value={heatmapData.summary.student_count}
              subtitle="Evaluated students"
              icon={Users}
              colorScheme="amber"
            />
            <StatCard
              title="Curriculum Concepts"
              value={heatmapData.summary.concept_count}
              subtitle={`${activeSubject.label} nodes`}
              icon={Layers}
              colorScheme="teal"
            />
            <StatCard
              title="Class Avg Readiness"
              value={
                heatmapData.summary.average_readiness_score !== null
                  ? `${heatmapData.summary.average_readiness_score}%`
                  : "N/A"
              }
              subtitle="Confidence-weighted mean"
              icon={Award}
              colorScheme="emerald"
            />
            <StatCard
              title="Assessment Density"
              value={`${heatmapData.summary.coverage_percentage}%`}
              subtitle={`${heatmapData.summary.assessed_cell_count} total evaluation cells`}
              icon={Grid}
              colorScheme="indigo"
            />
          </div>

          {/* 1. INTERACTIVE HEATMAP MATRIX TABLE */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Concept Mastery Matrix
                </h3>
                <p className="text-xs text-stone-500">
                  Each row represents a learner; columns show progression from
                  foundation prerequisites (left) to target concepts (right).
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono font-medium">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-200 border border-emerald-400" />
                  &ge;85% Mastered
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-teal-200 border border-teal-400" />
                  70-84% Proficient
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-amber-200 border border-amber-400" />
                  50-69% Developing
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-rose-200 border border-rose-400" />
                  &lt;50% Critical Gap
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-rose-400 border border-rose-600 ring-1 ring-rose-400" />
                  Root Bottleneck
                </span>
              </div>
            </div>

            {/* Scrollable Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-100/70 text-[11px] font-bold text-stone-700 font-mono uppercase tracking-wider">
                    <th className="p-3 sticky left-0 bg-stone-100 z-10 min-w-[140px] border-r border-stone-200">
                      Learner
                    </th>
                    <th className="p-3 min-w-[100px] border-r border-stone-200 text-center">
                      Readiness
                    </th>
                    {heatmapData.columns.map((col) => (
                      <th
                        key={col.concept_id}
                        className="p-3 min-w-[150px] max-w-[200px] border-r border-stone-200 last:border-r-0 text-center truncate"
                        title={col.label}
                      >
                        <div className="text-[10px] text-stone-400 font-mono">
                          Level {col.position}
                        </div>
                        <div className="truncate font-sans font-bold text-stone-800 normal-case">
                          {col.label}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {heatmapData.rows.map((row) => (
                    <tr
                      key={row.user_id}
                      className="hover:bg-stone-50/60 transition-colors"
                    >
                      {/* Sticky Student Header */}
                      <td className="p-3 sticky left-0 bg-white hover:bg-stone-50/60 z-10 border-r border-stone-200 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-[10px]">
                            {row.user_id}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900">
                              Student #{row.user_id}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono truncate max-w-[110px]">
                              {row.next_action.type.replace(/_/g, " ")}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Student Overall Readiness Score */}
                      <td className="p-3 border-r border-stone-200 text-center font-mono font-bold">
                        {row.readiness_score !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              row.readiness_score >= 70
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                : "bg-rose-100 text-rose-900 border border-rose-300"
                            }`}
                          >
                            {row.readiness_score}%
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>

                      {/* Concept Evaluation Cells */}
                      {heatmapData.columns.map((col) => {
                        const cell = cellMap.get(
                          `${row.user_id}-${col.concept_id}`,
                        );
                        if (!cell) {
                          return (
                            <td
                              key={col.concept_id}
                              className="p-3 text-center text-stone-300 border-r border-stone-200 last:border-r-0"
                            >
                              —
                            </td>
                          );
                        }

                        const style = getCellStyles(cell);

                        return (
                          <td
                            key={col.concept_id}
                            onClick={() =>
                              setActiveCellDetail({
                                studentId: row.user_id,
                                conceptLabel: col.label,
                                cell,
                              })
                            }
                            className="p-2 border-r border-stone-200 last:border-r-0 cursor-pointer text-center"
                          >
                            <div
                              className={`p-2 rounded-lg border transition-all hover:scale-105 hover:shadow-xs flex flex-col items-center justify-center gap-0.5 ${style.bg} ${style.border}`}
                            >
                              <span className={`text-xs ${style.text}`}>
                                {cell.assessed && cell.mastery_score !== null
                                  ? `${cell.mastery_score}%`
                                  : "N/A"}
                              </span>

                              {cell.is_root_gap && (
                                <span className="text-[9px] uppercase font-bold tracking-wider font-mono text-rose-800 flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Root
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Cell Modal / Detail Drawer */}
          {activeCellDetail && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold uppercase font-mono">
                    Student #{activeCellDetail.studentId}
                  </span>
                  <h4 className="text-sm font-bold text-stone-900">
                    {activeCellDetail.conceptLabel}
                  </h4>
                </div>
                <p className="text-xs text-stone-600">
                  Status: {activeCellDetail.cell.tier.replace(/_/g, " ")} •
                  Mastery:{" "}
                  {activeCellDetail.cell.mastery_score !== null
                    ? `${activeCellDetail.cell.mastery_score}%`
                    : "Unassessed"}
                  {activeCellDetail.cell.is_root_gap &&
                    " • Identified as a primary root-cause bottleneck!"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <MasteryTierBadge
                  tier={activeCellDetail.cell.tier}
                  score={activeCellDetail.cell.mastery_score}
                  size="md"
                />
                <button
                  onClick={() => setActiveCellDetail(null)}
                  className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* 2. ROOT-CAUSE BOTTLENECK DISTRIBUTION */}
          {heatmapData.root_gap_distribution &&
            heatmapData.root_gap_distribution.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider font-mono">
                  <TrendingDown className="w-4 h-4" /> Cohort Prerequisite
                  Bottlenecks
                </div>
                <h3 className="text-base font-bold text-stone-900">
                  Top Root-Cause Concept Weaknesses
                </h3>
                <p className="text-xs text-stone-600">
                  These upstream prerequisite concepts are causing the highest
                  rate of progression failure across your cohort.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-2">
                  {heatmapData.root_gap_distribution.map((gap) => (
                    <div
                      key={gap.concept_id}
                      className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-stone-900">
                          {gap.label}
                        </h4>
                        <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 text-[10px] font-bold font-mono">
                          {gap.student_count} student
                          {gap.student_count > 1 ? "s" : ""} (
                          {gap.student_percentage}%)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-rose-200/60 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-rose-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, gap.student_percentage)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* 3. CONCEPT AGGREGATE SUMMARY TABLE */}
          {heatmapData.concept_summary &&
            heatmapData.concept_summary.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/50">
                  <h3 className="text-sm font-bold text-stone-900">
                    Concept Aggregates & At-Risk Ratios
                  </h3>
                  <p className="text-xs text-stone-500">
                    Summary statistics per curriculum concept across the
                    evaluated cohort.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-100/60 text-[11px] font-bold text-stone-700 font-mono uppercase tracking-wider">
                        <th className="p-3">Concept</th>
                        <th className="p-3 text-center">Assessed</th>
                        <th className="p-3 text-center">Avg Mastery</th>
                        <th className="p-3 text-center">
                          Meets Gate (&ge;70%)
                        </th>
                        <th className="p-3 text-center">At Risk (&lt;50%)</th>
                        <th className="p-3 text-center">Root Gaps</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-mono">
                      {heatmapData.concept_summary.map((cs) => (
                        <tr
                          key={cs.concept_id}
                          className="hover:bg-stone-50/50"
                        >
                          <td className="p-3 font-sans font-medium text-stone-900">
                            {cs.label}
                          </td>
                          <td className="p-3 text-center text-stone-600">
                            {cs.assessed_students} /{" "}
                            {cs.assessed_students + cs.unknown_students}
                          </td>
                          <td className="p-3 text-center font-bold text-stone-900">
                            {cs.average_mastery_score !== null
                              ? `${cs.average_mastery_score}%`
                              : "N/A"}
                          </td>
                          <td className="p-3 text-center text-emerald-700 font-bold">
                            {cs.can_progress_students}
                          </td>
                          <td className="p-3 text-center text-rose-700 font-bold">
                            {cs.at_risk_students}
                          </td>
                          <td className="p-3 text-center font-bold">
                            {cs.root_gap_students > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                                {cs.root_gap_students}
                              </span>
                            ) : (
                              <span className="text-stone-400">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </>
      )}
    </div>
  );
};
