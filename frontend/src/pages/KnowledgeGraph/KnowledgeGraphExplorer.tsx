import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { intelligenceApi, assessmentApi } from "../../services/api";
import { buildBaselineCurriculumGraph } from "../../services/curriculumGraph";
import { LearnerFrontendPayload, AttemptAnalysisInput } from "../../types";
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
  User,
  Sparkles,
  Milestone,
  X,
  ArrowRight,
  HelpCircle,
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryAttemptId = searchParams.get("attempt_id")
    ? Number(searchParams.get("attempt_id"))
    : null;

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

  // Helper to fetch completed attempts specifically matching the active class and subject
  const fetchSubjectMatchedAttempts = async (): Promise<
    AttemptAnalysisInput[]
  > => {
    try {
      const dbAttempts = await assessmentApi.listCompletedAttempts({
        class_level: activeSubject.classLevel,
      });

      const targetSubject = activeSubject.subject.toLowerCase();
      const filtered = dbAttempts.filter((a) => {
        if (a.subject_name) {
          return a.subject_name.toLowerCase().includes(targetSubject);
        }
        if (a.assessment_title) {
          return a.assessment_title.toLowerCase().includes(targetSubject);
        }
        return false;
      });

      return filtered.map((a, idx) => ({
        attempt_id: a.attempt_id,
        assessment_type:
          idx === 0 && filtered.length > 1 ? "reassessment" : "diagnostic",
      }));
    } catch {
      return [];
    }
  };

  const loadGraph = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSelectedTopicForRemediation(null);
    setRemediationData(null);

    try {
      if (queryAttemptId) {
        // Specific query attempt requested
        try {
          const data = await intelligenceApi.getLearnerFrontend(
            queryAttemptId,
            "diagnostic",
            activeSubject.defaultTarget,
          );
          setFrontendData(data);
          return;
        } catch (queryErr) {
          console.warn("Could not load specific query attempt:", queryErr);
        }
      }

      // 1. Fetch attempts matching the selected class level & subject
      const matchingAttempts = await fetchSubjectMatchedAttempts();

      if (matchingAttempts.length > 0) {
        try {
          const data = await intelligenceApi.getHistoryFrontend(
            matchingAttempts,
            activeSubject.defaultTarget,
          );
          setFrontendData(data);
          return;
        } catch (apiErr) {
          console.warn(
            "Intelligence history analysis failed for subject attempts, falling back to baseline DAG:",
            apiErr,
          );
        }
      }

      // 2. If student has not yet taken a quiz in this subject, generate clean baseline curriculum DAG
      const baselineData = buildBaselineCurriculumGraph(
        activeSubject.classLevel,
        activeSubject.subject,
        activeSubject.defaultTarget,
      );
      setFrontendData(baselineData);
    } catch (err) {
      console.warn("Falling back to baseline curriculum graph:", err);
      const fallbackData = buildBaselineCurriculumGraph(
        activeSubject.classLevel,
        activeSubject.subject,
        activeSubject.defaultTarget,
      );
      setFrontendData(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, [queryAttemptId, selectedSubjectIdx]);

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

    try {
      const matchingAttempts = await fetchSubjectMatchedAttempts();

      if (matchingAttempts.length > 0) {
        try {
          const data = await intelligenceApi.getHistoryFrontend(
            matchingAttempts,
            conceptId,
          );
          setRemediationData(data);
          return;
        } catch (apiErr) {
          console.warn(
            "Could not compute remediation via intelligence API:",
            apiErr,
          );
        }
      }

      // Baseline remediation for unassessed topic
      const baselineRemediation = buildBaselineCurriculumGraph(
        activeSubject.classLevel,
        activeSubject.subject,
        conceptId,
      );
      setRemediationData(baselineRemediation);
    } catch (err) {
      console.warn("Attempting fallback for concept remediation:", err);
      const fallbackRemediation = buildBaselineCurriculumGraph(
        activeSubject.classLevel,
        activeSubject.subject,
        conceptId,
      );
      setRemediationData(fallbackRemediation);
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
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full pb-12">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
              <GitFork className="w-3.5 h-3.5" /> Curriculum Competency Network
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              Subject Knowledge Graph
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Explore prerequisite concept dependencies and cumulative student
              mastery across NCERT subjects.
            </p>
          </div>

          {/* Student Status & Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-stone-100/80 px-3 py-1.5 rounded-lg border border-stone-200/80 text-xs">
              <User className="w-3.5 h-3.5 text-teal-800" />
              <span className="text-stone-600 font-medium">
                Mastery Profile:
              </span>
              <span className="font-semibold text-stone-800">
                {queryAttemptId
                  ? `Quiz Attempt #${queryAttemptId}`
                  : "Cumulative (All Attempts)"}
              </span>
            </div>

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
            No Graph Available
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Unable to load competency network for {activeSubject.label}.
          </p>
        </div>
      ) : (
        <>
          {/* Top High-Level Graph Stats */}
          {graphStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                title="Syllabus Concepts"
                value={graphStats.totalNodes}
                subtitle={`${activeSubject.label} nodes`}
                icon={Layers}
                colorScheme="teal"
              />
              <StatCard
                title="Prerequisite Edges"
                value={graphStats.totalEdges}
                subtitle="Directed dependency paths"
                icon={GitFork}
                colorScheme="indigo"
              />
              <StatCard
                title="Assessment Coverage"
                value={`${graphStats.coveragePercent}%`}
                subtitle={`${graphStats.assessedNodes} of ${graphStats.totalNodes} evaluated`}
                icon={Award}
                colorScheme="emerald"
              />
              <StatCard
                title="Critical Gaps"
                value={graphStats.criticalNodes}
                subtitle="Concepts requiring remediation"
                icon={Target}
                colorScheme={graphStats.criticalNodes > 0 ? "rose" : "stone"}
              />
            </div>
          )}

          {/* Interactive DAG Graph Component with Hover Popover Inspector */}
          <KnowledgeGraphView
            graph={frontendData.graphs.competency}
            title={`${activeSubject.label} Knowledge Graph`}
            subtitle="Left-to-right progression: Foundation prerequisites (Level 0) flow into higher-order dependent topics."
            onViewRemediation={handleViewRemediation}
          />

          {/* TOPIC-SPECIFIC REMEDIATION & LEARNING PATH SECTION */}
          {selectedTopicForRemediation && (
            <div
              id="topic-remediation-section"
              className="bg-white rounded-2xl border-2 border-teal-800/80 p-5 sm:p-7 shadow-lg space-y-6 scroll-mt-20 animate-in fade-in slide-in-from-bottom-4 duration-200"
            >
              {/* Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-900 border border-teal-300 font-mono">
                      <Sparkles className="w-3 h-3" /> Target Remediation Route
                    </span>
                    <span className="text-xs text-stone-500 font-mono">
                      Cumulative Profile
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">
                    {selectedTopicForRemediation.label}
                  </h2>
                  <p className="text-xs text-stone-600">
                    Prerequisite-first learning route and root-cause analysis
                    generated specifically for mastering this topic.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedTopicForRemediation(null);
                      setRemediationData(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 hover:text-stone-900 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Dismiss Remediation</span>
                  </button>
                </div>
              </div>

              {/* Error Message for Remediation */}
              {remediationError && (
                <AlertBanner
                  type="warning"
                  title="Notice"
                  message={remediationError}
                  onClose={() => setRemediationError(null)}
                />
              )}

              {/* Loading State with Instant Visual Feedback */}
              {remediationLoading ? (
                <div className="p-10 sm:p-14 text-center bg-teal-50/50 rounded-xl border border-teal-200/80 shadow-inner space-y-4 animate-in fade-in duration-150">
                  <LoadingSpinner
                    label={`Synthesizing root-cause dependency trace and prerequisite learning steps for "${selectedTopicForRemediation.label}"...`}
                  />
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    Analyzing cumulative student diagnostics, prerequisite
                    weaknesses, and probabilistic mastery gates...
                  </p>
                </div>
              ) : remediationData ? (
                <div className="space-y-6">
                  {/* 1. Focused Root-Cause Dependency Trace */}
                  {remediationData.graphs?.root_cause && (
                    <KnowledgeGraphView
                      graph={remediationData.graphs.root_cause}
                      title={`Root-Cause Dependency Trace: ${selectedTopicForRemediation.label}`}
                      subtitle="Focused upstream trace explaining why prerequisite weakness impacts your target concept."
                      showHoverMenu={false}
                    />
                  )}

                  {/* 2. Step-by-Step Gated Learning Path */}
                  {remediationData.learning_path && (
                    <LearningPathStepper
                      learningPath={remediationData.learning_path}
                      onSelectStep={(step) => {
                        if (step.status !== "LOCKED") {
                          navigate("/curriculum");
                        }
                      }}
                    />
                  )}

                  {/* Quick Action Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-teal-50/70 border border-teal-200 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center flex-shrink-0">
                        <Milestone className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-stone-900">
                          Ready to practice prerequisite concepts?
                        </h4>
                        <p className="text-[11px] text-stone-600">
                          Master the root cause gaps to unlock full competency
                          for {selectedTopicForRemediation.label}.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate("/curriculum")}
                      className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-all whitespace-nowrap"
                    >
                      <span>Explore Chapter Resources</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <HelpCircle className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="text-xs text-stone-500">
                    No active prerequisite gaps detected for this topic.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
