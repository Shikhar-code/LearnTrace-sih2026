import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  intelligenceApi,
  masteryApi,
  getApiErrorMessage,
} from "../../services/api";
import {
  LearnerFrontendPayload,
  MasteryInputResponse,
  NextAction,
} from "../../types";
import { Badge } from "../../components/common/Badge";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { AlertBanner } from "../../components/common/AlertBanner";
import { StatCard } from "../../components/common/StatCard";
import {
  NextActionCard,
  LearningPathStepper,
  KnowledgeGraphView,
  MasteryProfileGrid,
  ConceptImprovementCard,
} from "../../components/intelligence";
import {
  GitFork,
  Milestone,
  Layers,
  History,
  Award,
  Clock,
  Sparkles,
  RefreshCw,
  HelpCircle,
  BookOpen,
  Check,
  XCircle,
} from "lucide-react";

interface MasteryDashboardProps {
  initialAttemptId?: number | null;
}

type ActiveTab = "remediation" | "knowledge_map" | "profile" | "history";

export const MasteryDashboard: React.FC<MasteryDashboardProps> = ({
  initialAttemptId,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryAttemptId = searchParams.get("attempt_id")
    ? Number(searchParams.get("attempt_id"))
    : null;

  // Single Attempt State
  const [attemptIdInput, setAttemptIdInput] = useState<number>(
    queryAttemptId || initialAttemptId || 1,
  );
  const [targetConceptId, setTargetConceptId] = useState<string>("");

  // Data State
  const [frontendData, setFrontendData] =
    useState<LearnerFrontendPayload | null>(null);
  const [rawAttemptData, setRawAttemptData] =
    useState<MasteryInputResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>("remediation");

  // Load Intelligence for Single Attempt
  const loadIntelligence = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const idToFetch = attemptIdInput;
      const frontend = await intelligenceApi.getLearnerFrontend(
        idToFetch,
        "diagnostic",
        targetConceptId ? targetConceptId : undefined,
      );
      setFrontendData(frontend);

      // Fetch raw response telemetry for the attempt
      try {
        const raw = await masteryApi.getMasteryInput(idToFetch);
        setRawAttemptData(raw);
      } catch {
        setRawAttemptData(null);
      }
    } catch (err) {
      setErrorMessage(
        `Failed to evaluate learning intelligence. ${getApiErrorMessage(err)}`,
      );
      setFrontendData(null);
      setRawAttemptData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const idToFetch = queryAttemptId || initialAttemptId || attemptIdInput;
    setAttemptIdInput(idToFetch);
  }, [queryAttemptId, initialAttemptId]);

  useEffect(() => {
    loadIntelligence();
  }, [attemptIdInput]);

  // Next Action CTA Click Handler
  const handleActionClick = (action: NextAction) => {
    if (action.type === "TAKE_DIAGNOSTIC") {
      navigate("/quiz");
    } else {
      navigate("/curriculum");
    }
  };

  // Raw Response Stats
  const rawStats = useMemo(() => {
    if (!rawAttemptData || !rawAttemptData.responses?.length) return null;
    const total = rawAttemptData.responses.length;
    const correct = rawAttemptData.responses.filter(
      (r) => r.is_correct === true,
    ).length;
    const totalTime = rawAttemptData.responses.reduce(
      (acc, curr) => acc + (curr.response_time_seconds || 0),
      0,
    );
    const avgTime = Math.round(totalTime / total);
    return { total, correct, avgTime, score: rawAttemptData.score };
  }, [rawAttemptData]);

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Explainable Learning
              Intelligence
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              Mastery & Root-Cause Remediation
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Probabilistic concept mastery, prerequisite gap detection, and
              progression path planning.
            </p>
          </div>

          {/* Quick Inspection Controls */}
          <div className="flex items-center gap-1.5 bg-stone-100 p-1.5 rounded-lg border border-stone-200/80 text-xs">
            <span className="font-medium text-stone-600 px-1 text-[11px]">
              Attempt ID:
            </span>
            <input
              type="number"
              min={1}
              value={attemptIdInput}
              onChange={(e) => setAttemptIdInput(Number(e.target.value))}
              className="w-16 px-2 py-1 bg-white border border-stone-300 rounded font-mono text-center font-bold text-stone-800 text-xs"
            />

            <button
              onClick={() => {
                setSearchParams({ attempt_id: attemptIdInput.toString() });
                loadIntelligence();
              }}
              className="px-3.5 py-1.5 bg-teal-800 text-white rounded-lg font-semibold hover:bg-teal-900 text-xs flex items-center gap-1.5 shadow-xs transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              Analyze
            </button>
          </div>
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
          <LoadingSpinner label="Running Bayesian mastery inference & prerequisite trace..." />
        </div>
      ) : !frontendData ? (
        <div className="bg-white p-12 rounded-xl border border-stone-200/80 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-stone-800 text-sm">
            No Learning Intelligence Found
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            No completed attempts found for Attempt #{attemptIdInput}. Start and
            complete an assessment in the <strong>Quiz Runner</strong>.
          </p>
        </div>
      ) : (
        <>
          {/* Top High-Level Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Readiness Index"
              value={
                frontendData.summary.readiness_score !== null
                  ? `${frontendData.summary.readiness_score}%`
                  : "N/A"
              }
              subtitle="Confidence-weighted mastery"
              icon={Award}
              colorScheme="teal"
            />
            <StatCard
              title="Root Gap Risk"
              value={
                frontendData.summary.root_gap_probability !== null
                  ? `${Math.round(frontendData.summary.root_gap_probability * 100)}%`
                  : "0%"
              }
              subtitle="Upstream prerequisite deficit"
              icon={GitFork}
              colorScheme="rose"
            />
            <StatCard
              title="Target Concept"
              value={
                frontendData.summary.target.mastery_score !== null
                  ? `${frontendData.summary.target.mastery_score}%`
                  : "Unknown"
              }
              subtitle={frontendData.summary.target.label}
              icon={BookOpen}
              colorScheme="amber"
            />
            <StatCard
              title="Response Velocity"
              value={rawStats ? `${rawStats.avgTime}s` : "N/A"}
              subtitle={
                rawStats
                  ? `${rawStats.correct}/${rawStats.total} correct`
                  : "Per-question latency"
              }
              icon={Clock}
              colorScheme="stone"
            />
          </div>

          {/* Recommended Next Action Banner */}
          {frontendData.summary.next_action && (
            <NextActionCard
              action={frontendData.summary.next_action}
              readinessScore={frontendData.summary.readiness_score}
              rootGapProbability={frontendData.summary.root_gap_probability}
              onActionClick={handleActionClick}
            />
          )}

          {/* Navigation View Tabs */}
          <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("remediation")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "remediation"
                  ? "bg-teal-800 text-white shadow-xs"
                  : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/80"
              }`}
            >
              <Milestone className="w-3.5 h-3.5" />
              <span>AI Remediation & Learning Path</span>
            </button>

            <button
              onClick={() => setActiveTab("knowledge_map")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "knowledge_map"
                  ? "bg-teal-800 text-white shadow-xs"
                  : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/80"
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Subject Competency Map</span>
            </button>

            <button
              onClick={() => setActiveTab("profile")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "profile"
                  ? "bg-teal-800 text-white shadow-xs"
                  : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/80"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                Mastery Profile ({frontendData.mastery_profile.length})
              </span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "history"
                  ? "bg-teal-800 text-white shadow-xs"
                  : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/80"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Response Telemetry</span>
            </button>
          </div>

          {/* TAB 1: Remediation & Root-Cause Analysis */}
          {activeTab === "remediation" && (
            <div className="space-y-6">
              {/* Focused Why-Am-I-Stuck Root Cause Graph */}
              <KnowledgeGraphView
                graph={frontendData.graphs.root_cause}
                title="Root-Cause Dependency Trace"
                subtitle="Focused upstream trace explaining why prerequisite weakness impacts your target concept."
                showHoverMenu={false}
              />

              {/* Gated Learning Path Stepper */}
              <LearningPathStepper
                learningPath={frontendData.learning_path}
                onSelectStep={(step) => {
                  if (step.status !== "LOCKED") {
                    navigate("/curriculum");
                  }
                }}
              />
            </div>
          )}

          {/* TAB 2: Full Knowledge Map DAG */}
          {activeTab === "knowledge_map" && (
            <KnowledgeGraphView
              graph={frontendData.graphs.competency}
              title="Full Curriculum Competency Network"
              subtitle="Complete Class 9–10 prerequisite graph. Foundation concepts are on the left, advancing to complex dependents on the right."
            />
          )}

          {/* TAB 3: Mastery Profile Grid */}
          {activeTab === "profile" && (
            <MasteryProfileGrid
              profile={frontendData.mastery_profile}
              onSelectConcept={(concept) => {
                setTargetConceptId(concept.id);
                loadIntelligence();
              }}
            />
          )}

          {/* TAB 4: Progress & Telemetry Audit */}
          {activeTab === "history" && (
            <div className="space-y-6">
              {/* Multi-Attempt Improvement Telemetry */}
              <ConceptImprovementCard progress={frontendData.progress} />

              {/* Question-by-Question Response Audit */}
              {rawAttemptData &&
                rawAttemptData.responses &&
                rawAttemptData.responses.length > 0 && (
                  <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs p-4 sm:p-6 space-y-4">
                    <div className="border-b border-stone-100 pb-3">
                      <h2 className="font-bold text-sm text-stone-900 uppercase tracking-wide">
                        Raw Response Telemetry (
                        {rawAttemptData.responses.length})
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Individual student responses evaluated against the
                        academic curriculum.
                      </p>
                    </div>

                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                        <thead>
                          <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-600 uppercase text-[10px] tracking-wider font-semibold">
                            <th className="py-2.5 px-3">Resp #</th>
                            <th className="py-2.5 px-3">Subject & Chapter</th>
                            <th className="py-2.5 px-3">Topic</th>
                            <th className="py-2.5 px-3">Question</th>
                            <th className="py-2.5 px-3">Latency</th>
                            <th className="py-2.5 px-3 text-right">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {rawAttemptData.responses.map((resp) => (
                            <tr
                              key={resp.response_id}
                              className="hover:bg-stone-50 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-mono text-stone-500">
                                #{resp.response_id}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-stone-900">
                                  {resp.subject || "—"}
                                </div>
                                <div className="text-[10px] text-stone-400">
                                  {resp.chapter || "—"}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-stone-800">
                                {resp.topic}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-stone-500">
                                Q#{resp.question_id}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-stone-600">
                                {resp.response_time_seconds
                                  ? `${resp.response_time_seconds}s`
                                  : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                {resp.is_correct === true ? (
                                  <Badge variant="emerald" size="sm">
                                    <Check className="w-3 h-3" /> Correct
                                  </Badge>
                                ) : resp.is_correct === false ? (
                                  <Badge variant="rose" size="sm">
                                    <XCircle className="w-3 h-3" /> Incorrect
                                  </Badge>
                                ) : (
                                  <Badge variant="stone" size="sm">
                                    Unchecked
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
