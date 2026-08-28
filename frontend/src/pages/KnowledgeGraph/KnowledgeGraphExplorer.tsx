import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { intelligenceApi, getApiErrorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { getStudentAttempts } from "../../services/attemptStorage";
import { LearnerFrontendPayload } from "../../types";
import {
  KnowledgeGraphView,
  LearningPathStepper,
} from "../../components/intelligence";
import { StatCard } from "../../components/common/StatCard";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { AlertBanner } from "../../components/common/AlertBanner";
import {
  GitFork,
  BookOpen,
  Layers,
  Award,
  RefreshCw,
  Target,
  Sparkles,
  Milestone,
  X,
} from "lucide-react";

const SUBJECT_OPTIONS = [
  {
    classLevel: 10,
    subject: "Mathematics",
    label: "Class 10 — Mathematics",
    defaultTarget: "class-10:mathematics:some-applications-of-trigonometry",
    color: "teal",
  },
  {
    classLevel: 10,
    subject: "Science",
    label: "Class 10 — Science",
    defaultTarget: "class-10:science:chemical-reactions-and-equations",
    color: "emerald",
  },
  {
    classLevel: 9,
    subject: "Mathematics",
    label: "Class 9 — Mathematics",
    defaultTarget: "class-9:mathematics:the-world-of-numbers",
    color: "amber",
  },
  {
    classLevel: 9,
    subject: "Science",
    label: "Class 9 — Science",
    defaultTarget: "class-9:science:cell-the-building-block-of-life",
    color: "blue",
  },
];

export const KnowledgeGraphExplorer: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const queryAttemptId = searchParams.get("attempt_id")
    ? Number(searchParams.get("attempt_id"))
    : null;

  const activeStudentId = user?.id || 1;
  const studentAttempts = useMemo(
    () => getStudentAttempts(activeStudentId),
    [activeStudentId],
  );

  const [selectedSubjectIdx, setSelectedSubjectIdx] = useState<number>(0);
  const [frontendData, setFrontendData] =
    useState<LearnerFrontendPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Topic-Specific Remediation & Learning Path State
  const [selectedTopicForRemediation, setSelectedTopicForRemediation] =
    useState<{
      id: string;
      label: string;
    } | null>(null);
  const [remediationData, setRemediationData] =
    useState<LearnerFrontendPayload | null>(null);
  const [remediationLoading, setRemediationLoading] = useState<boolean>(false);
  const [remediationError, setRemediationError] = useState<string | null>(null);

  const activeSubject = SUBJECT_OPTIONS[selectedSubjectIdx];

  const loadGraph = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSelectedTopicForRemediation(null);
    setRemediationData(null);

    const primaryAttemptId = studentAttempts[0]?.attempt_id || activeStudentId;
    const primaryAttemptType =
      studentAttempts[0]?.assessment_type || "diagnostic";

    try {
      if (queryAttemptId) {
        // Specific quiz attempt analysis
        const data = await intelligenceApi.getLearnerFrontend(
          queryAttemptId,
          "diagnostic",
          activeSubject.defaultTarget,
        );
        setFrontendData(data);
      } else {
        // Cumulative attempts specifically for the current logged-in student
        const data = await intelligenceApi.getHistoryFrontend(
          studentAttempts,
          activeSubject.defaultTarget,
        );
        setFrontendData(data);
      }
    } catch {
      // Graceful fallback to student's primary attempt
      try {
        const fallbackData = await intelligenceApi.getLearnerFrontend(
          primaryAttemptId,
          primaryAttemptType,
          activeSubject.defaultTarget,
        );
        setFrontendData(fallbackData);
      } catch (fallbackErr) {
        setErrorMessage(
          `Failed to load knowledge graph for ${activeSubject.label}. ${getApiErrorMessage(fallbackErr)}`,
        );
        setFrontendData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, [queryAttemptId, selectedSubjectIdx, activeStudentId]);

  // Handler to fetch and display tailored remediation for any clicked topic
  const handleViewRemediation = async (
    conceptId: string,
    conceptLabel: string,
  ) => {
    setSelectedTopicForRemediation({ id: conceptId, label: conceptLabel });
    setRemediationLoading(true);
    setRemediationData(null);
    setRemediationError(null);

    // Instantly scroll down to the remediation section so user gets immediate visual feedback
    setTimeout(() => {
      const el = document.getElementById("topic-remediation-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 40);

    const primaryAttemptId = studentAttempts[0]?.attempt_id || activeStudentId;
    const primaryAttemptType =
      studentAttempts[0]?.assessment_type || "diagnostic";

    try {
      if (queryAttemptId) {
        const data = await intelligenceApi.getLearnerFrontend(
          queryAttemptId,
          "diagnostic",
          conceptId,
        );
        setRemediationData(data);
      } else {
        const data = await intelligenceApi.getHistoryFrontend(
          studentAttempts,
          conceptId,
        );
        setRemediationData(data);
      }
    } catch (err) {
      console.warn("Attempting fallback for concept remediation:", err);
      try {
        const fallbackData = await intelligenceApi.getLearnerFrontend(
          primaryAttemptId,
          primaryAttemptType,
          conceptId,
        );
        setRemediationData(fallbackData);
      } catch (fallbackErr) {
        setRemediationError(
          `Unable to generate remediation route for "${conceptLabel}". ${getApiErrorMessage(fallbackErr)}`,
        );
      }
    } finally {
      setRemediationLoading(false);
    }
  };

  // Graph metrics calculation
  const graphStats = useMemo(() => {
    if (!frontendData?.graphs?.competency) return null;
    const graph = frontendData.graphs.competency;
    const assessedNodes = graph.nodes.filter((n) => n.assessed).length;
    const masteredNodes = graph.nodes.filter(
      (n) => n.tier === "MASTERED" || n.tier === "PROFICIENT",
    ).length;
    const criticalNodes = graph.nodes.filter(
      (n) => n.tier === "CRITICAL_GAP",
    ).length;

    return {
      totalNodes: graph.node_count,
      totalEdges: graph.edge_count,
      assessedNodes,
      masteredNodes,
      criticalNodes,
      coveragePercent: Math.round(
        (assessedNodes / Math.max(1, graph.node_count)) * 100,
      ),
    };
  }, [frontendData]);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full pb-16">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
              <GitFork className="w-3.5 h-3.5" /> Prerequisite Knowledge
              Structure
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              Curriculum Knowledge Graph
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Topological mastery map across foundation prerequisites and target
              concepts for {activeSubject.label}.
            </p>
          </div>

          {/* Refresh Action */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={loadGraph}
              className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200/80 text-stone-700 border border-stone-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {/* Subject Filter Switcher Tabs */}
        <div className="mt-5 pt-4 border-t border-stone-100 flex items-center gap-2 overflow-x-auto pb-1">
          {SUBJECT_OPTIONS.map((sub, idx) => {
            const isSelected = selectedSubjectIdx === idx;
            return (
              <button
                key={sub.label}
                onClick={() => {
                  setSelectedSubjectIdx(idx);
                  setSelectedTopicForRemediation(null);
                  setRemediationData(null);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  isSelected
                    ? "bg-teal-800 text-white shadow-xs"
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
        <div className="bg-white p-12 rounded-xl border border-stone-200/80 text-center shadow-xs">
          <LoadingSpinner
            label={`Constructing directed competency DAG for ${activeSubject.label}...`}
          />
        </div>
      ) : !frontendData || !frontendData.graphs?.competency ? (
        <div className="bg-white p-12 rounded-xl border border-stone-200/80 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <GitFork className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-stone-800 text-sm">
            No Competency Graph Available
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Complete assessment quizzes for {activeSubject.label} to generate
            your personal concept dependency graph.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Stat Cards */}
          {graphStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                title="Curriculum Nodes"
                value={graphStats.totalNodes}
                subtitle={`${graphStats.totalEdges} prerequisite dependencies`}
                icon={Layers}
                colorScheme="teal"
              />
              <StatCard
                title="Evaluated Topics"
                value={`${graphStats.coveragePercent}%`}
                subtitle={`${graphStats.assessedNodes} of ${graphStats.totalNodes} assessed`}
                icon={Target}
                colorScheme="amber"
              />
              <StatCard
                title="Mastered Concepts"
                value={graphStats.masteredNodes}
                subtitle="Meeting 70% threshold"
                icon={Award}
                colorScheme="emerald"
              />
              <StatCard
                title="Identified Gaps"
                value={graphStats.criticalNodes}
                subtitle="Requiring remediation"
                icon={Sparkles}
                colorScheme="rose"
              />
            </div>
          )}

          {/* Interactive Knowledge Graph View */}
          <div className="space-y-2">
            <KnowledgeGraphView
              graph={frontendData.graphs.competency}
              title={`${activeSubject.label} — Prerequisite Dependency Graph`}
              subtitle="Hover over any topic card for 500ms to inspect prerequisites, mastery tiers, and unlocks. Click and drag anywhere to pan the graph."
              showHoverMenu={true}
              onViewRemediation={handleViewRemediation}
            />
          </div>

          {/* TOPIC-SPECIFIC REMEDIATION SECTION */}
          <div id="topic-remediation-section" className="scroll-mt-6">
            {remediationLoading ? (
              <div className="bg-white rounded-xl border border-teal-200/80 p-8 sm:p-12 shadow-xs text-center space-y-4 animate-in fade-in duration-200">
                <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto text-teal-800">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-stone-900">
                    Computing Targeted Remediation Route
                  </h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    Analyzing Bayesian root-cause dependencies and sequencing
                    gated prerequisites for{" "}
                    <span className="font-semibold text-teal-900">
                      "{selectedTopicForRemediation?.label}"
                    </span>
                    ...
                  </p>
                </div>
              </div>
            ) : selectedTopicForRemediation && remediationData ? (
              <div className="bg-white rounded-xl border border-teal-200/90 shadow-sm overflow-hidden animate-in fade-in duration-200">
                {/* Remediation Header */}
                <div className="bg-teal-50/60 border-b border-teal-100 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-teal-200/80 text-teal-900 text-[10px] font-bold uppercase font-mono tracking-wider">
                        Topic Remediation
                      </span>
                      <h3 className="text-base font-bold text-stone-900">
                        {selectedTopicForRemediation.label}
                      </h3>
                    </div>
                    <p className="text-xs text-stone-600">
                      Targeted learning sequence and upstream root-cause trace
                      to master this concept.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedTopicForRemediation(null);
                        setRemediationData(null);
                      }}
                      className="p-1.5 rounded-lg hover:bg-teal-100/60 text-stone-500 hover:text-stone-800 transition-colors"
                      title="Close remediation panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-6 space-y-6">
                  {/* Root-Cause Sub-Graph */}
                  {remediationData.graphs?.root_cause && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider font-mono">
                        <GitFork className="w-3.5 h-3.5" /> Root-Cause
                        Dependency Trace
                      </div>
                      <KnowledgeGraphView
                        graph={remediationData.graphs.root_cause}
                        title={`Prerequisite Chain for ${selectedTopicForRemediation.label}`}
                        subtitle="Upstream concepts causing gaps in mastering this target topic."
                        showHoverMenu={false}
                      />
                    </div>
                  )}

                  {/* Gated Learning Path Stepper */}
                  {remediationData.learning_path && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2 text-teal-800 font-bold text-xs uppercase tracking-wider font-mono">
                        <Milestone className="w-3.5 h-3.5" /> Recommended
                        Intervention Steps
                      </div>
                      <LearningPathStepper
                        learningPath={remediationData.learning_path}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : remediationError ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 flex items-center justify-between">
                <span>{remediationError}</span>
                <button
                  onClick={() => {
                    setSelectedTopicForRemediation(null);
                    setRemediationError(null);
                  }}
                  className="px-2 py-1 bg-white border border-rose-300 rounded text-[11px] font-bold text-rose-800"
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};
