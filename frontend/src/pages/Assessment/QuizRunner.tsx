import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  assessmentApi,
  academicApi,
  aiQuizApi,
  getApiErrorMessage,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { recordStudentAttempt } from "../../services/attemptStorage";
import {
  Assessment,
  AssessmentQuestion,
  StartAttemptResponse,
  FinishAttemptResponse,
  Subject,
  Chapter,
  Topic,
} from "../../types";
import { Badge } from "../../components/common/Badge";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { AlertBanner } from "../../components/common/AlertBanner";
import {
  PlayCircle,
  Clock,
  CheckCircle,
  ArrowRight,
  RotateCcw,
  BarChart3,
  Award,
  BookOpen,
  Sparkles,
  Zap,
  X,
} from "lucide-react";

interface QuizRunnerProps {
  onNavigateToMastery?: (attemptId: number) => void;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  onNavigateToMastery,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryAssessmentId = searchParams.get("assessment_id")
    ? Number(searchParams.get("assessment_id"))
    : null;

  // Assessment Selection & Loader
  const [assessmentIdInput, setAssessmentIdInput] = useState<number>(
    queryAssessmentId || 1,
  );
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState<boolean>(false);

  // Active Quiz Attempt State
  const [attempt, setAttempt] = useState<StartAttemptResponse | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<boolean>(false);

  // Per-Question Timer (in seconds)
  const [questionTimeSeconds, setQuestionTimeSeconds] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Completed State
  const [finishedResult, setFinishedResult] =
    useState<FinishAttemptResponse | null>(null);

  // AI Quiz Generator Modal State
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [modalClassLevel, setModalClassLevel] = useState<number>(10);
  const [modalSubjects, setModalSubjects] = useState<Subject[]>([]);
  const [modalSubjectId, setModalSubjectId] = useState<number | null>(null);
  const [modalChapters, setModalChapters] = useState<Chapter[]>([]);
  const [modalChapterId, setModalChapterId] = useState<number | null>(null);
  const [modalTopics, setModalTopics] = useState<Topic[]>([]);
  const [modalTopicId, setModalTopicId] = useState<number | null>(null);
  const [modalDifficulty, setModalDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("medium");
  const [modalDuration, setModalDuration] = useState<number>(10);
  const [isGeneratingAiQuiz, setIsGeneratingAiQuiz] = useState<boolean>(false);

  // UI Alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load Assessment Definition
  const loadAssessment = async (id: number) => {
    setLoadingAssessment(true);
    setErrorMessage(null);
    setAttempt(null);
    setFinishedResult(null);
    try {
      const data = await assessmentApi.getAssessment(id);
      setAssessment(data);
    } catch (err) {
      setErrorMessage(
        `Failed to fetch Assessment #${id}. ${getApiErrorMessage(err)}`,
      );
      setAssessment(null);
    } finally {
      setLoadingAssessment(false);
    }
  };

  useEffect(() => {
    const idToLoad = queryAssessmentId || assessmentIdInput;
    setAssessmentIdInput(idToLoad);
    loadAssessment(idToLoad);
  }, [queryAssessmentId]);

  // Timer Management during active attempt
  useEffect(() => {
    if (attempt && !finishedResult) {
      setQuestionTimeSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setQuestionTimeSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [attempt, currentQuestionIndex, finishedResult]);

  // AI Modal Taxonomy Loading
  useEffect(() => {
    if (!showAiModal) return;
    const fetchSubs = async () => {
      try {
        const subs = await academicApi.getSubjects(modalClassLevel);
        setModalSubjects(subs);
        if (subs.length > 0) setModalSubjectId(subs[0].id);
      } catch (e) {
        console.warn(e);
      }
    };
    fetchSubs();
  }, [showAiModal, modalClassLevel]);

  useEffect(() => {
    if (!showAiModal || !modalSubjectId) return;
    const fetchChaps = async () => {
      try {
        const chaps = await academicApi.getChapters(modalSubjectId);
        setModalChapters(chaps);
        if (chaps.length > 0) setModalChapterId(chaps[0].id);
      } catch (e) {
        console.warn(e);
      }
    };
    fetchChaps();
  }, [showAiModal, modalSubjectId]);

  useEffect(() => {
    if (!showAiModal || !modalChapterId) return;
    const fetchTops = async () => {
      try {
        const tops = await academicApi.getTopics(modalChapterId);
        setModalTopics(tops);
        if (tops.length > 0) setModalTopicId(tops[0].id);
      } catch (e) {
        console.warn(e);
      }
    };
    fetchTops();
  }, [showAiModal, modalChapterId]);

  // Start Assessment Attempt
  const handleStartAttempt = async () => {
    if (!assessment) return;
    setErrorMessage(null);
    setFinishedResult(null);
    setCurrentQuestionIndex(0);
    setSelectedOptionId(null);
    setQuestionTimeSeconds(0);

    try {
      const startRes = await assessmentApi.startAttempt(
        assessment.id,
        user?.id || 1,
      );
      recordStudentAttempt(user?.id || 1, startRes.attempt_id, "diagnostic");
      setAttempt(startRes);
      setSuccessMessage(
        `Assessment session started! (Attempt ID #${startRes.attempt_id})`,
      );
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  };

  // Submit Current Response & Move Next / Finish
  const handleNextOrFinish = async () => {
    if (!attempt || !assessment) return;
    const currentQ: AssessmentQuestion =
      assessment.questions[currentQuestionIndex];

    if (!selectedOptionId) {
      setErrorMessage("Please select an option before proceeding.");
      return;
    }

    setIsSubmittingAnswer(true);
    setErrorMessage(null);

    try {
      await assessmentApi.submitResponse(attempt.attempt_id, {
        question_id: currentQ.question_id,
        selected_option_id: selectedOptionId,
        response_time_seconds: questionTimeSeconds,
      });

      const nextIndex = currentQuestionIndex + 1;

      if (nextIndex < assessment.questions.length) {
        setCurrentQuestionIndex(nextIndex);
        setSelectedOptionId(null);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        const finishRes = await assessmentApi.finishAttempt(attempt.attempt_id);
        setFinishedResult(finishRes);
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleReset = () => {
    setAttempt(null);
    setFinishedResult(null);
    setCurrentQuestionIndex(0);
    setSelectedOptionId(null);
    setQuestionTimeSeconds(0);
    loadAssessment(assessmentIdInput);
  };

  // Handle AI Quiz Generation from Modal & Auto-Launch
  const handleGenerateAiQuizFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTopicId) {
      setErrorMessage("Please select a topic to generate questions from.");
      return;
    }

    setIsGeneratingAiQuiz(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFinishedResult(null);

    try {
      // 1. Generate Quiz via Backend RAG & LLM (Fixed 10 standard questions)
      const res = await aiQuizApi.generateQuiz({
        topic_id: modalTopicId,
        number_of_questions: 10,
        difficulty: modalDifficulty,
        duration_minutes: modalDuration,
      });

      // 2. Fetch the newly created Assessment
      const fetchedAssessment = await assessmentApi.getAssessment(
        res.assessment_id,
      );
      setAssessment(fetchedAssessment);
      setAssessmentIdInput(res.assessment_id);
      setSearchParams({ assessment_id: res.assessment_id.toString() });

      // 3. Auto-start the attempt immediately
      const startRes = await assessmentApi.startAttempt(res.assessment_id, 1);
      setAttempt(startRes);
      setCurrentQuestionIndex(0);
      setSelectedOptionId(null);
      setQuestionTimeSeconds(0);

      setShowAiModal(false);
      setSuccessMessage(
        `AI Quiz "${res.title}" generated! Quiz session started automatically.`,
      );
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsGeneratingAiQuiz(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto w-full">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
              <PlayCircle className="w-3.5 h-3.5" /> Assessment Runner
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              Interactive Quiz Runner
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Take an interactive topic quiz with per-question latency
              measurement and automatic grading.
            </p>
          </div>

          {/* Assessment ID Selector & AI Generator Button */}
          {!attempt && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowAiModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-lg text-xs font-semibold transition-all shadow-2xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Generate AI Quiz</span>
              </button>

              <div className="flex items-center gap-1 bg-stone-100 p-1.5 rounded-lg border border-stone-200/80 text-xs justify-between">
                <span className="font-medium text-stone-600 px-1 text-[11px]">
                  Quiz ID:
                </span>
                <input
                  type="number"
                  min={1}
                  value={assessmentIdInput}
                  onChange={(e) => setAssessmentIdInput(Number(e.target.value))}
                  className="w-14 px-2 py-1 bg-white border border-stone-300 rounded font-mono text-center font-bold text-stone-800 text-xs"
                />
                <button
                  onClick={() => {
                    setSearchParams({
                      assessment_id: assessmentIdInput.toString(),
                    });
                    loadAssessment(assessmentIdInput);
                  }}
                  className="px-3 py-1 bg-stone-900 text-white rounded font-medium hover:bg-stone-800 text-xs"
                >
                  Load
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <AlertBanner
          type="error"
          title="Notice"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
      {successMessage && !attempt && (
        <AlertBanner
          type="success"
          title="Ready"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* AI Quiz Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                    Generate AI Assessment
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    RAG-grounded in official NCERT textbook passages
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* In-Modal Error Alert */}
            {errorMessage && (
              <AlertBanner
                type="error"
                title="Generation Notice"
                message={errorMessage}
                onClose={() => setErrorMessage(null)}
              />
            )}

            <form
              onSubmit={handleGenerateAiQuizFromModal}
              className="space-y-4 text-xs"
            >
              {/* Grade & Subject */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                    Grade Level
                  </label>
                  <select
                    value={modalClassLevel}
                    onChange={(e) => setModalClassLevel(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none"
                  >
                    <option value={9}>Class 9</option>
                    <option value={10}>Class 10</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                    Subject
                  </label>
                  <select
                    value={modalSubjectId ?? ""}
                    onChange={(e) => setModalSubjectId(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none"
                  >
                    {modalSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chapter */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Chapter
                </label>
                <select
                  value={modalChapterId ?? ""}
                  onChange={(e) => setModalChapterId(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none truncate"
                >
                  {modalChapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Topic (Grounding Target)
                </label>
                <select
                  value={modalTopicId ?? ""}
                  onChange={(e) => setModalTopicId(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none truncate font-medium"
                >
                  {modalTopics.length === 0 ? (
                    <option value="">No topics in chapter</option>
                  ) : (
                    modalTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Question Parameters (Fixed to 10 Standard Questions) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                    Difficulty
                  </label>
                  <select
                    value={modalDifficulty}
                    onChange={(e) =>
                      setModalDifficulty(
                        e.target.value as "easy" | "medium" | "hard",
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                    Duration
                  </label>
                  <select
                    value={modalDuration}
                    onChange={(e) => setModalDuration(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  >
                    <option value={10}>10 Mins</option>
                    <option value={15}>15 Mins</option>
                    <option value={20}>20 Mins</option>
                  </select>
                </div>
              </div>

              {/* Assessment Standard Info Pill */}
              <div className="bg-stone-50 border border-stone-200/80 rounded-lg p-2.5 text-[11px] text-stone-600 flex items-center justify-between">
                <span>Assessment Structure:</span>
                <span className="font-semibold text-stone-800">
                  10 MCQs (4 options, 1 correct)
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingAiQuiz || !modalTopicId}
                  className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-2 shadow-xs"
                >
                  {isGeneratingAiQuiz ? (
                    <>
                      <LoadingSpinner size="sm" className="text-white" />
                      <span>Generating with AI...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                      <span>Generate & Start Quiz Now</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loadingAssessment ? (
        <div className="bg-white p-10 sm:p-12 rounded-xl border border-stone-200/80 text-center shadow-xs">
          <LoadingSpinner label="Fetching assessment details..." />
        </div>
      ) : !assessment ? (
        <div className="bg-white p-10 sm:p-12 rounded-xl border border-stone-200/80 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-stone-800 text-sm">
              No Assessment Found
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              Assessment #{assessmentIdInput} could not be loaded. You can
              generate a new NCERT topic quiz with AI!
            </p>
          </div>
          <button
            onClick={() => setShowAiModal(true)}
            className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 shadow-xs"
          >
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span>Generate New AI Quiz</span>
          </button>
        </div>
      ) : finishedResult ? (
        /* QUIZ FINISHED RESULTS SCREEN */
        <div className="bg-white rounded-xl border border-stone-200/80 p-5 sm:p-8 shadow-xs text-center space-y-5 sm:space-y-6">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center mx-auto shadow-2xs">
            <Award className="w-7 h-7" />
          </div>

          <div>
            <Badge variant="emerald" size="md">
              Assessment Completed
            </Badge>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mt-2 tracking-tight">
              {assessment.title}
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Attempt ID:{" "}
              <span className="font-mono font-semibold text-stone-800">
                #{finishedResult.attempt_id}
              </span>{" "}
              • User: Demo Student (#1)
            </p>
          </div>

          {/* Score Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-lg mx-auto py-1">
            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 sm:p-4">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Total Score
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-teal-800 mt-1">
                {finishedResult.score}%
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 sm:p-4">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Correct Answers
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-1">
                {finishedResult.correct ?? "—"} /{" "}
                {finishedResult.answered ?? assessment.questions.length}
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 sm:p-4">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Status
              </span>
              <div className="text-sm font-bold text-stone-800 mt-2 flex items-center justify-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-700" /> Finished
              </div>
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-stone-100">
            <button
              onClick={() => {
                navigate(`/tutor?attempt_id=${finishedResult.attempt_id}`);
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-stone-900 text-white rounded-lg font-medium text-xs hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Review Mistakes with AI Tutor</span>
            </button>

            <button
              onClick={() => {
                if (onNavigateToMastery) {
                  onNavigateToMastery(finishedResult.attempt_id);
                } else {
                  navigate(`/mastery?attempt_id=${finishedResult.attempt_id}`);
                }
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-teal-800 text-white rounded-lg font-medium text-xs hover:bg-teal-900 transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <BarChart3 className="w-4 h-4" />
              <span>View Mastery for Attempt #{finishedResult.attempt_id}</span>
            </button>

            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-5 py-2.5 bg-stone-100 text-stone-700 border border-stone-200 rounded-lg font-medium text-xs hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retake Quiz</span>
            </button>
          </div>
        </div>
      ) : !attempt ? (
        /* PRE-QUIZ OVERVIEW SCREEN */
        <div className="bg-white rounded-xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="teal" size="sm">
                  Class {assessment.class_level}
                </Badge>
                {assessment.duration_minutes && (
                  <Badge variant="stone" size="sm">
                    <Clock className="w-3 h-3" /> {assessment.duration_minutes}{" "}
                    Mins
                  </Badge>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 mt-2 tracking-tight">
                {assessment.title}
              </h2>
              {assessment.description && (
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  {assessment.description}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                Total Questions
              </span>
              <div className="text-xl sm:text-2xl font-bold text-stone-900">
                {assessment.questions.length}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200/70 text-xs text-stone-700 space-y-2">
            <h4 className="font-semibold text-stone-900">Quiz Guidelines:</h4>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-stone-600">
              <li>
                Each question tracks response latency (time to answer) for
                velocity analysis.
              </li>
              <li>
                Select the single most appropriate option and click Next to
                record your response.
              </li>
              <li>
                Scores and per-topic mastery metrics are evaluated automatically
                upon submission.
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={handleStartAttempt}
              disabled={assessment.questions.length === 0}
              className="w-full py-3 bg-teal-800 text-white rounded-xl font-medium text-xs hover:bg-teal-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Start Assessment Now</span>
            </button>
          </div>
        </div>
      ) : (
        /* ACTIVE QUESTION RUNNER */
        <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs overflow-hidden">
          {/* Active Quiz Header Bar */}
          <div className="bg-stone-900 text-white px-4 sm:px-6 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 text-xs">
              <span className="font-medium text-stone-300 uppercase tracking-wider text-[11px] sm:text-xs">
                Question {currentQuestionIndex + 1} of{" "}
                {assessment.questions.length}
              </span>
              <span className="text-stone-600">|</span>
              <span className="font-mono text-stone-400 text-[10px] sm:text-xs">
                Attempt #{attempt.attempt_id}
              </span>
            </div>

            {/* Per-Question Live Timer */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-stone-800 px-2.5 sm:px-3 py-1 rounded-full border border-stone-700 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-stone-300 text-[11px] sm:text-xs">
                Time:{" "}
                <strong className="text-white">{questionTimeSeconds}s</strong>
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-stone-100 h-1">
            <div
              className="bg-teal-700 h-1 transition-all duration-300"
              style={{
                width: `${((currentQuestionIndex + 1) / assessment.questions.length) * 100}%`,
              }}
            />
          </div>

          {/* Question Card Body */}
          <div className="p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
            {/* Question Text */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="teal" size="sm">
                  Q{currentQuestionIndex + 1}
                </Badge>
                <Badge
                  variant={
                    assessment.questions[currentQuestionIndex].difficulty ===
                    "hard"
                      ? "rose"
                      : assessment.questions[currentQuestionIndex]
                            .difficulty === "medium"
                        ? "amber"
                        : "emerald"
                  }
                  size="sm"
                >
                  {assessment.questions[currentQuestionIndex].difficulty}
                </Badge>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-stone-900 leading-relaxed">
                {assessment.questions[currentQuestionIndex].question_text}
              </h3>
            </div>

            {/* Touch-Friendly Options List */}
            <div className="space-y-2.5 sm:space-y-3">
              {assessment.questions[currentQuestionIndex].options.map(
                (option, idx) => {
                  const isSelected = selectedOptionId === option.id;
                  const letter = String.fromCharCode(65 + idx);
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSelectedOptionId(option.id)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-xl border text-xs font-medium transition-all flex items-center gap-3 ${
                        isSelected
                          ? "bg-teal-50/80 border-teal-600 text-teal-950 ring-1 ring-teal-600 shadow-2xs"
                          : "bg-white border-stone-200/80 text-stone-700 hover:bg-stone-50 hover:border-stone-300 active:bg-stone-100"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold font-mono transition-colors flex-shrink-0 ${
                          isSelected
                            ? "bg-teal-800 text-white"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="flex-1 text-xs sm:text-sm leading-relaxed">
                        {option.option_text}
                      </span>
                    </button>
                  );
                },
              )}
            </div>

            {/* Footer Navigation Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-stone-100">
              <span className="text-[11px] text-stone-400 font-mono self-start sm:self-auto">
                Topic ID: #{assessment.questions[currentQuestionIndex].topic_id}
              </span>

              <button
                onClick={handleNextOrFinish}
                disabled={isSubmittingAnswer || !selectedOptionId}
                className="w-full sm:w-auto min-w-[160px] h-10 px-5 bg-teal-800 text-white rounded-lg font-medium text-xs hover:bg-teal-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                {isSubmittingAnswer ? (
                  <>
                    <LoadingSpinner size="sm" className="text-white" />
                    <span>Saving...</span>
                  </>
                ) : currentQuestionIndex + 1 === assessment.questions.length ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Submit & Finish</span>
                  </>
                ) : (
                  <>
                    <span>Next Question</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
