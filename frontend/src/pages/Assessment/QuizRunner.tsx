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
  Sparkles,
  Zap,
  BookOpen,
} from "lucide-react";

interface QuizRunnerProps {
  onNavigateToMastery?: (attemptId: number) => void;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  onNavigateToMastery,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  // Active Quiz Assessment State
  const [assessment, setAssessment] = useState<Assessment | null>(null);
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

  // AI Quiz Generator Form State
  const [classLevel, setClassLevel] = useState<number>(user?.class_level || 10);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState<number | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [duration, setDuration] = useState<number>(10);
  const [isGeneratingAiQuiz, setIsGeneratingAiQuiz] = useState<boolean>(false);

  // UI Alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Load Subjects when class level changes
  useEffect(() => {
    const fetchSubs = async () => {
      try {
        const subs = await academicApi.getSubjects(classLevel);
        setSubjects(subs);
        if (subs.length > 0) setSubjectId(subs[0].id);
      } catch (e) {
        console.warn(e);
      }
    };
    fetchSubs();
  }, [classLevel]);

  // Load Chapters when subject changes
  useEffect(() => {
    if (!subjectId) return;
    const fetchChaps = async () => {
      try {
        const chaps = await academicApi.getChapters(subjectId);
        setChapters(chaps);
        if (chaps.length > 0) setChapterId(chaps[0].id);
      } catch (e) {
        console.warn(e);
      }
    };
    fetchChaps();
  }, [subjectId]);

  // Load Topics when chapter changes
  useEffect(() => {
    if (!chapterId) return;
    const fetchTops = async () => {
      try {
        const tops = await academicApi.getTopics(chapterId);
        setTopics(tops);
        if (tops.length > 0) setTopicId(tops[0].id);
      } catch (e) {
        console.warn(e);
      }
    };
    fetchTops();
  }, [chapterId]);

  // Handle AI Quiz Generation and Instant Auto-Start
  const handleGenerateAiQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicId) {
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
        topic_id: topicId,
        number_of_questions: 10,
        difficulty: difficulty,
        duration_minutes: duration,
      });

      // 2. Fetch the newly created Assessment
      const fetchedAssessment = await assessmentApi.getAssessment(
        res.assessment_id,
      );
      setAssessment(fetchedAssessment);
      setSearchParams({ assessment_id: res.assessment_id.toString() });

      // 3. Auto-start the attempt immediately for current user
      const studentId = user?.id || 1;
      const startRes = await assessmentApi.startAttempt(res.assessment_id, studentId);
      recordStudentAttempt(studentId, startRes.attempt_id, "diagnostic");
      setAttempt(startRes);
      setCurrentQuestionIndex(0);
      setSelectedOptionId(null);
      setQuestionTimeSeconds(0);

      setSuccessMessage(
        `AI Quiz "${res.title}" generated successfully with ${res.questions_created} NCERT questions! Good luck!`,
      );
    } catch (err) {
      setErrorMessage(`AI Quiz generation failed. ${getApiErrorMessage(err)}`);
    } finally {
      setIsGeneratingAiQuiz(false);
    }
  };

  // Submit Single Question Response & Advance
  const handleAnswerSubmit = async () => {
    if (!attempt || !assessment || selectedOptionId === null) return;

    const currentQ = assessment.questions[currentQuestionIndex];
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

        const studentId = user?.id || 1;
        recordStudentAttempt(studentId, attempt.attempt_id, "diagnostic");

        // Record attempt in localStorage for the AI Tutor Hub
        try {
          const saved = JSON.parse(
            localStorage.getItem("learntrace_recent_attempts") || "[]",
          );
          const item = {
            id: attempt.attempt_id,
            assessment_id: assessment.id,
            assessment_title: assessment.title,
            class_level: assessment.class_level,
            score: finishRes.score,
            completed: true,
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
            total_questions: assessment.questions.length,
            wrong_count:
              assessment.questions.length - (finishRes.correct || 0),
          };
          localStorage.setItem(
            "learntrace_recent_attempts",
            JSON.stringify(
              [item, ...saved.filter((x: any) => x.id !== item.id)].slice(
                0,
                25,
              ),
            ),
          );
        } catch {
          // Non-blocking
        }
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  // Reset to Generator Screen
  const handleResetToGenerator = () => {
    setAttempt(null);
    setAssessment(null);
    setFinishedResult(null);
    setCurrentQuestionIndex(0);
    setSelectedOptionId(null);
    setQuestionTimeSeconds(0);
    setSearchParams({});
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto w-full">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
              <PlayCircle className="w-3.5 h-3.5" /> Assessment Studio
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              {attempt && !finishedResult
                ? `Taking Assessment: ${assessment?.title || "Quiz"}`
                : finishedResult
                ? "Assessment Completed"
                : "AI-Powered NCERT Assessment Studio"}
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              {attempt && !finishedResult
                ? "Select the best option and advance. Latency is measured per question."
                : finishedResult
                ? "Review your results, examine misconceptions with the AI Tutor, or check mastery analytics."
                : "Generate 10-question multiple-choice quizzes grounded in official textbook passages and benchmark your concept mastery."}
            </p>
          </div>

          {(attempt || finishedResult) && (
            <button
              onClick={handleResetToGenerator}
              className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border border-stone-200 self-start sm:self-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New AI Quiz</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <AlertBanner
          type="error"
          title="Notice"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
      {successMessage && (
        <AlertBanner
          type="success"
          title="Ready"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Conditional Content */}
      {finishedResult && assessment ? (
        /* ────────────────────────────────────────────────────────── */
        /* 1. COMPLETION RESULT SCREEN                                */
        /* ────────────────────────────────────────────────────────── */
        <div className="bg-white rounded-xl border border-stone-200/80 p-5 sm:p-8 shadow-xs text-center space-y-6 animate-in fade-in duration-200">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-teal-50 text-teal-800 border border-teal-200/80 mx-auto">
            <CheckCircle className="w-8 h-8 text-teal-800" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
              Assessment Completed!
            </h2>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              Your responses have been recorded and evaluated by the Bayesian
              mastery engine.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl mx-auto text-left">
            <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-3.5 sm:p-4">
              <span className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider">
                Overall Score
              </span>
              <div className="text-xl sm:text-2xl font-bold text-teal-900 mt-1">
                {finishedResult.score}%
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 sm:p-4">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Correct
              </span>
              <div className="text-xl sm:text-2xl font-bold text-stone-800 mt-1">
                {finishedResult.correct ?? "-"} /{" "}
                {finishedResult.answered ?? assessment.questions.length}
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 sm:p-4">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Total Questions
              </span>
              <div className="text-xl sm:text-2xl font-bold text-stone-800 mt-1">
                {assessment.questions.length}
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 sm:p-4">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                Status
              </span>
              <div className="text-xs font-bold text-stone-800 mt-2 flex items-center gap-1.5">
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
              onClick={handleResetToGenerator}
              className="w-full sm:w-auto px-5 py-2.5 bg-stone-100 text-stone-700 border border-stone-200 rounded-lg font-medium text-xs hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Generate Another Quiz</span>
            </button>
          </div>
        </div>
      ) : !attempt ? (
        /* ────────────────────────────────────────────────────────── */
        /* 2. AI QUIZ GENERATOR STUDIO (MAIN IN-PAGE SCREEN)          */
        /* ────────────────────────────────────────────────────────── */
        <div className="bg-white rounded-xl border border-stone-200/80 p-5 sm:p-7 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Configure & Generate Assessment
              </h2>
              <p className="text-xs text-stone-500">
                Select your grade, subject, and chapter. The AI will extract
                NCERT passages and construct a 10-MCQ quiz instantly.
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateAiQuiz} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Class Selection */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Grade Level
                </label>
                <select
                  value={classLevel}
                  onChange={(e) => setClassLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  <option value={9}>Class 9</option>
                  <option value={10}>Class 10</option>
                </select>
              </div>

              {/* Subject Selection */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Subject
                </label>
                <select
                  value={subjectId || ""}
                  onChange={(e) => setSubjectId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Chapter Selection */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Chapter
                </label>
                <select
                  value={chapterId || ""}
                  onChange={(e) => setChapterId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  {chapters.map((chap) => (
                    <option key={chap.id} value={chap.id}>
                      {chap.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic Selection */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Topic (Grounding Target)
                </label>
                <select
                  value={topicId || ""}
                  onChange={(e) => setTopicId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  {topics.map((top) => (
                    <option key={top.id} value={top.id}>
                      {top.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Difficulty */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(
                      e.target.value as "easy" | "medium" | "hard",
                    )
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  <option value="easy">Easy (Foundational Recall)</option>
                  <option value="medium">
                    Medium (Application & Problem Solving)
                  </option>
                  <option value="hard">Hard (Conceptual Multi-Step)</option>
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  <option value={10}>10 Minutes (Standard)</option>
                  <option value={15}>15 Minutes</option>
                  <option value={20}>20 Minutes</option>
                </select>
              </div>
            </div>

            {/* Assessment Structure Pill */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 text-[11px] text-stone-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-800" />
                <span>RAG Source: Official NCERT Passages</span>
              </div>
              <span className="font-semibold text-stone-800">
                10 MCQs (4 options, 1 correct) • Latency Tracking
              </span>
            </div>

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isGeneratingAiQuiz || !topicId}
                className="w-full py-3.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                {isGeneratingAiQuiz ? (
                  <>
                    <LoadingSpinner size="sm" className="text-white" />
                    <span>
                      Analyzing NCERT Textbook & Generating 10 Questions...
                    </span>
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
      ) : (
        /* ────────────────────────────────────────────────────────── */
        /* 3. ACTIVE QUESTION RUNNER                                   */
        /* ────────────────────────────────────────────────────────── */
        <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs overflow-hidden">
          {/* Active Quiz Header Bar */}
          <div className="bg-stone-900 text-white px-4 sm:px-6 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 text-xs">
              <span className="font-medium text-stone-300 uppercase tracking-wider text-[11px] sm:text-xs">
                Question {currentQuestionIndex + 1} of{" "}
                {assessment?.questions.length}
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
          {assessment && (
            <div className="w-full bg-stone-100 h-1">
              <div
                className="bg-teal-700 h-1 transition-all duration-300"
                style={{
                  width: `${((currentQuestionIndex + 1) / assessment.questions.length) * 100}%`,
                }}
              />
            </div>
          )}

          {/* Question Card Body */}
          {assessment && (
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
                        className={`w-full text-left p-3.5 sm:p-4 rounded-xl border text-xs sm:text-sm transition-all flex items-center gap-3 sm:gap-4 ${
                          isSelected
                            ? "bg-teal-50 border-teal-800 text-teal-950 ring-1 ring-teal-800 font-semibold shadow-2xs"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                            isSelected
                              ? "bg-teal-800 text-white"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="flex-1 leading-snug">
                          {option.option_text}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>

              {/* Action Button: Next or Submit */}
              <div className="pt-4 border-t border-stone-100 flex items-center justify-end">
                <button
                  onClick={handleAnswerSubmit}
                  disabled={selectedOptionId === null || isSubmittingAnswer}
                  className="w-full sm:w-auto px-6 py-2.5 bg-teal-800 text-white rounded-lg font-medium text-xs hover:bg-teal-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  {isSubmittingAnswer ? (
                    <>
                      <LoadingSpinner size="sm" className="text-white" />
                      <span>Saving Response...</span>
                    </>
                  ) : currentQuestionIndex + 1 < assessment.questions.length ? (
                    <>
                      <span>Next Question</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Submit Assessment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
