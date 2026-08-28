import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { tutorApi, assessmentApi, masteryApi, getApiErrorMessage } from '../../services/api';
import { TutorContext, TutorResponse, AttemptSummaryItem } from '../../types';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AlertBanner } from '../../components/common/AlertBanner';
import {
  Sparkles,
  Bot,
  BookOpen,
  CheckCircle,
  XCircle,
  Lightbulb,
  RotateCcw,
  Zap,
  GraduationCap,
  FileCheck2,
  AlertTriangle,
  History,
  ArrowRight,
} from 'lucide-react';

export const AiTutor: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryAttemptId = searchParams.get('attempt_id') ? Number(searchParams.get('attempt_id')) : null;

  // Service Health State
  const [tutorOnline, setTutorOnline] = useState<boolean | null>(null);

  // Recent Attempts Hub State
  const [recentAttempts, setRecentAttempts] = useState<AttemptSummaryItem[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState<boolean>(false);

  // Active Context & AI Tutor Response
  const [activeContext, setActiveContext] = useState<TutorContext | null>(
    (location.state as { tutorContext?: TutorContext })?.tutorContext || null
  );
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState<boolean>(false);

  // Attempt Multi-Mistake Navigation (if arriving from Quiz attempt)
  const [mistakeList, setMistakeList] = useState<TutorContext[]>([]);
  const [selectedMistakeIndex, setSelectedMistakeIndex] = useState<number>(0);
  const [activeAttemptTitle, setActiveAttemptTitle] = useState<string>('');

  // Interactive Practice Question State
  const [selectedPracticeOption, setSelectedPracticeOption] = useState<string | null>(null);
  const [practiceSubmitted, setPracticeSubmitted] = useState<boolean>(false);

  // UI state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check AI Tutor Service Health
  useEffect(() => {
    const verifyHealth = async () => {
      const isUp = await tutorApi.checkHealth();
      setTutorOnline(isUp);
    };
    verifyHealth();
    const interval = setInterval(verifyHealth, 20000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recent attempts on mount
  useEffect(() => {
    loadRecentAttempts();
  }, []);

  const loadRecentAttempts = async () => {
    setLoadingAttempts(true);
    try {
      const local = localStorage.getItem('learntrace_recent_attempts');
      let combined: AttemptSummaryItem[] = [];
      if (local) {
        try {
          combined = JSON.parse(local);
        } catch {
          combined = [];
        }
      }

      // If empty, provide standard demo attempts
      if (combined.length === 0) {
        combined = [
          {
            id: 1,
            assessment_id: 1,
            assessment_title: 'LearnTrace Demo Assessment (Triangles & Real Numbers)',
            class_level: 10,
            score: 67,
            completed: true,
            started_at: new Date().toISOString(),
            total_questions: 9,
            wrong_count: 3,
          },
        ];
      }

      setRecentAttempts(combined);
    } catch {
      // Non-blocking
    } finally {
      setLoadingAttempts(false);
    }
  };

  // Handle Query Attempt ID on mount or change
  useEffect(() => {
    if (queryAttemptId) {
      loadAttemptMistakes(queryAttemptId);
    } else if (activeContext) {
      fetchExplanation(activeContext);
    }
  }, [queryAttemptId]);

  // Load Attempt and extract incorrect questions
  const loadAttemptMistakes = async (attemptId: number) => {
    setLoadingExplanation(true);
    setErrorMessage(null);
    try {
      const masteryData = await masteryApi.getMasteryInput(attemptId);
      const assessData = await assessmentApi.getAssessment(
        masteryData.assessment_id,
      );
      setActiveAttemptTitle(assessData.title);

      // Filter incorrect questions
      const incorrectResponses = masteryData.responses.filter(
        (r) => r.is_correct === false,
      );
      const contexts: TutorContext[] = [];

      for (const resp of incorrectResponses) {
        const matchingQ = assessData.questions.find(
          (q) => q.question_id === resp.question_id,
        );
        if (matchingQ && matchingQ.options.length >= 2) {
          // 1. Find the actual correct option text
          const correctOptObj =
            matchingQ.options.find((o) => o.is_correct === true) ||
            matchingQ.options[0];
          const correctOptText = correctOptObj.option_text;

          // 2. Find the actual learner selected option text
          let selectedOptText = "Alternate Conception";
          if (resp.selected_option_id) {
            const chosen = matchingQ.options.find(
              (o) => o.id === resp.selected_option_id,
            );
            if (chosen) selectedOptText = chosen.option_text;
          } else {
            const distractor = matchingQ.options.find(
              (o) => o.option_text !== correctOptText,
            );
            if (distractor) selectedOptText = distractor.option_text;
          }

          contexts.push({
            competency: {
              id: `topic_${resp.topic_id}`,
              name: resp.topic || "Syllabus Topic",
            },
            question: {
              id: `q_${resp.question_id}`,
              text: matchingQ.question_text,
              options: matchingQ.options.map((o) => o.option_text),
            },
            learner_answer: selectedOptText,
            correct_answer: correctOptText,
            detected_gap: {
              description: `Learner selected '${selectedOptText}' instead of '${correctOptText}' on ${resp.topic || "this topic"}.`,
            },
          });
        }
      }

      setMistakeList(contexts);
      if (contexts.length > 0) {
        setSelectedMistakeIndex(0);
        setActiveContext(contexts[0]);
        await fetchExplanation(contexts[0]);
      } else {
        setErrorMessage(
          "All questions in this attempt were answered correctly! No mistakes detected.",
        );
      }
    } catch (err) {
      setErrorMessage(
        `Failed to load attempt mistakes. ${getApiErrorMessage(err)}`,
      );
    } finally {
      setLoadingExplanation(false);
    }
  };

  // Call AI Tutor API to explain mistake
  const fetchExplanation = async (context: TutorContext) => {
    setLoadingExplanation(true);
    setErrorMessage(null);
    setTutorResponse(null);
    setSelectedPracticeOption(null);
    setPracticeSubmitted(false);

    try {
      const res = await tutorApi.explainMistake(context);
      setTutorResponse(res);
    } catch (err) {
      setErrorMessage(`AI Tutor error: ${getApiErrorMessage(err)}`);
    } finally {
      setLoadingExplanation(false);
    }
  };

  // Handle Mistake Tab Click
  const handleSelectMistake = (idx: number) => {
    setSelectedMistakeIndex(idx);
    const targetCtx = mistakeList[idx];
    if (targetCtx) {
      setActiveContext(targetCtx);
      fetchExplanation(targetCtx);
    }
  };

  // Select an attempt from the Hub
  const handleSelectAttemptFromHub = (attId: number) => {
    setSearchParams({ attempt_id: String(attId) });
  };

  // Return back to Hub view
  const handleBackToHub = () => {
    setSearchParams({});
    setActiveContext(null);
    setTutorResponse(null);
    setMistakeList([]);
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto w-full">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
              <GraduationCap className="w-4 h-4 text-teal-800" /> Socratic AI Tutor & Remediation Hub
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              {queryAttemptId
                ? `Reviewing Attempt #${queryAttemptId}: ${activeAttemptTitle || 'Assessment'}`
                : 'Personalized AI Tutoring & Misconception Remediation'}
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              {queryAttemptId
                ? 'Targeted misconception breakdowns, ELI5 concept explanations, and adaptive practice questions for your errors.'
                : 'Inspect your assessment attempts, resolve learning bottlenecks, and reinforce concepts with interactive practice.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {queryAttemptId && (
              <button
                onClick={handleBackToHub}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-all border border-stone-200"
              >
                ← All Attempts Hub
              </button>
            )}

            {/* Health Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-stone-50 border border-stone-200/80 rounded-lg text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  tutorOnline === true
                    ? 'bg-emerald-700 animate-pulse'
                    : tutorOnline === false
                    ? 'bg-rose-700'
                    : 'bg-amber-700'
                }`}
              />
              <span className="text-[11px] font-medium text-stone-600">
                {tutorOnline === true
                  ? 'AI Tutor Ready'
                  : tutorOnline === false
                  ? 'Tutor Offline'
                  : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <AlertBanner
          type="error"
          title="Tutor Notice"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* VIEW A: REMEDIATION HUB (When no attempt is actively selected) */}
      {/* ────────────────────────────────────────────────────────── */}
      {!queryAttemptId && !activeContext && (
        <div className="space-y-6">
          {/* Recent Attempts Grid */}
          <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-teal-800" />
                <h2 className="font-bold text-xs sm:text-sm text-stone-900 uppercase tracking-wide">
                  Recent Assessment Attempts ({recentAttempts.length})
                </h2>
              </div>
              <span className="text-[11px] text-stone-500">Click any attempt to launch AI Tutoring on its mistakes</span>
            </div>

            {loadingAttempts ? (
              <div className="py-8 text-center">
                <LoadingSpinner label="Loading recent assessment history..." />
              </div>
            ) : recentAttempts.length === 0 ? (
              <div className="p-8 text-center text-stone-500 space-y-2">
                <BookOpen className="w-8 h-8 mx-auto text-stone-400" />
                <p className="text-xs">No assessment attempts recorded yet.</p>
                <button
                  onClick={() => navigate('/quiz')}
                  className="px-4 py-2 bg-teal-800 text-white text-xs font-semibold rounded-lg hover:bg-teal-900 transition-all"
                >
                  Start Your First Quiz
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentAttempts.map((att) => {
                  const hasMistakes = (att.wrong_count ?? 0) > 0;
                  return (
                    <div
                      key={att.id}
                      className="p-4 sm:p-5 rounded-xl border border-stone-200 hover:border-stone-300 transition-all bg-white hover:shadow-xs flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="stone" size="sm">
                            Attempt #{att.id} • Class {att.class_level || 10}
                          </Badge>
                          <Badge
                            variant={att.score >= 80 ? 'emerald' : att.score >= 50 ? 'amber' : 'rose'}
                            size="sm"
                          >
                            Score: {att.score}%
                          </Badge>
                        </div>

                        <h3 className="font-bold text-sm text-stone-900 leading-snug">
                          {att.assessment_title || `Assessment #${att.assessment_id}`}
                        </h3>

                        <div className="flex items-center gap-3 text-xs text-stone-500 pt-1">
                          <span>Total: {att.total_questions ?? 10} Qs</span>
                          <span>•</span>
                          <span className={hasMistakes ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                            {att.wrong_count ?? 0} Mistake{(att.wrong_count ?? 0) === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[10px] text-stone-400 font-mono">
                          {att.started_at ? new Date(att.started_at).toLocaleDateString() : 'Recent'}
                        </span>

                        <button
                          onClick={() => handleSelectAttemptFromHub(att.id)}
                          className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shadow-2xs"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Review Mistakes with AI Tutor</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* VIEW B: ACTIVE ATTEMPT MISTAKES REVIEW & TUTOR LESSON */}
      {/* ────────────────────────────────────────────────────────── */}
      {(queryAttemptId || activeContext) && (
        <>
          {/* Multiple Mistakes Selector Bar */}
          {mistakeList.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200/80 p-3 sm:p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Mistakes from Attempt #{queryAttemptId} ({mistakeList.length} Found)
                </span>
                <span className="text-[11px] text-stone-500">Click any question to get an AI breakdown</span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {mistakeList.map((m, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectMistake(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedMistakeIndex === idx
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Mistake #{idx + 1}: {m.competency.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main 2-Column Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            {/* Left Column: Context Card (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-xs space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-teal-800" />
                    <h2 className="font-semibold text-xs text-stone-900 uppercase tracking-wide">
                      Assessment Context
                    </h2>
                  </div>
                </div>

                {/* Quiz Attempt Mistake View */}
                {!activeContext ? (
                  <div className="py-8 text-center">
                    <LoadingSpinner label="Loading mistake context from assessment..." />
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                        Competency / Topic
                      </span>
                      <div className="font-bold text-stone-900 mt-0.5">{activeContext.competency.name}</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                        Question
                      </span>
                      <div className="text-stone-800 bg-stone-50 p-2.5 rounded-lg border border-stone-200/70 mt-0.5 leading-relaxed font-medium">
                        {activeContext.question.text}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-900 text-[11px]">
                        <span className="font-bold block">Your Answer:</span>
                        {activeContext.learner_answer}
                      </div>

                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-[11px]">
                        <span className="font-bold block">Correct Concept / Answer:</span>
                        {activeContext.correct_answer}
                      </div>
                    </div>

                    {activeContext.detected_gap && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Detected Gap:</span>
                          {activeContext.detected_gap.description}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        onClick={() => fetchExplanation(activeContext)}
                        disabled={loadingExplanation}
                        className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Regenerate Explanation</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: AI Tutor Outputs (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {loadingExplanation ? (
                <div className="bg-white rounded-xl border border-stone-200/80 p-12 text-center shadow-xs space-y-3">
                  <LoadingSpinner label="AI Tutor is analyzing your mistake and synthesizing lesson..." />
                </div>
              ) : !tutorResponse ? (
                <div className="bg-white rounded-xl border border-stone-200/80 p-10 text-center shadow-xs space-y-3">
                  <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center mx-auto">
                    <Bot className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-stone-800 text-sm">Select a Question to Review</h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    Choose one of the mistakes from the top bar or fill the context on the left to receive a structured pedagogical explanation, ELI5 summary, worked example, and practice question.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Output 1: Detailed Misconception Breakdown */}
                  <div className="bg-white rounded-xl border border-teal-200/90 shadow-xs p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-teal-900 font-bold text-xs uppercase tracking-wide">
                      <Lightbulb className="w-4 h-4 text-amber-600 fill-amber-500" />
                      <span>Why That Answer Happened (Misconception Analysis)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                      {tutorResponse.explanation}
                    </p>
                  </div>

                  {/* Output 2: Simplified Concept (ELI5) */}
                  <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-stone-900 font-bold text-xs uppercase tracking-wide">
                      <Sparkles className="w-4 h-4 text-teal-700" />
                      <span>Core Concept in Simple Terms</span>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-700 leading-relaxed bg-stone-50 p-3.5 rounded-lg border border-stone-200/60">
                      {tutorResponse.simple_explanation}
                    </p>
                  </div>

                  {/* Output 3: Worked Example */}
                  <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-stone-900 font-bold text-xs uppercase tracking-wide">
                      <FileCheck2 className="w-4 h-4 text-teal-800" />
                      <span>Step-by-Step Worked Example</span>
                    </div>
                    <div className="text-xs sm:text-sm text-stone-800 whitespace-pre-line leading-relaxed bg-stone-50 p-3.5 rounded-lg border border-stone-200/60 font-mono">
                      {tutorResponse.worked_example}
                    </div>
                  </div>

                  {/* Output 4: Interactive Practice Question */}
                  {tutorResponse.practice_question && (
                    <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                        <div className="flex items-center gap-2 text-stone-900 font-bold text-xs uppercase tracking-wide">
                          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span>Adaptive Reinforcement Question</span>
                        </div>
                        <Badge variant="teal" size="sm">
                          Instant Check
                        </Badge>
                      </div>

                      <p className="text-xs sm:text-sm font-semibold text-stone-900 leading-relaxed">
                        {tutorResponse.practice_question.question}
                      </p>

                      {/* Options */}
                      <div className="space-y-2">
                        {tutorResponse.practice_question.options.map((opt, idx) => {
                          const isSelected = selectedPracticeOption === opt;
                          const letter = String.fromCharCode(65 + idx);
                          const isCorrectOpt = opt === tutorResponse.practice_question.correct_option;

                          let btnStyle = 'bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-800';
                          if (practiceSubmitted) {
                            if (isCorrectOpt) {
                              btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold ring-1 ring-emerald-500';
                            } else if (isSelected && !isCorrectOpt) {
                              btnStyle = 'bg-rose-50 border-rose-500 text-rose-950 font-semibold ring-1 ring-rose-500';
                            }
                          } else if (isSelected) {
                            btnStyle = 'bg-teal-50 border-teal-800 text-teal-950 font-semibold ring-1 ring-teal-800';
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (!practiceSubmitted) setSelectedPracticeOption(opt);
                              }}
                              disabled={practiceSubmitted}
                              className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center gap-3 ${btnStyle}`}
                            >
                              <span className="w-5 h-5 rounded flex items-center justify-center font-mono font-bold text-[11px] bg-white border border-stone-200">
                                {letter}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {practiceSubmitted && isCorrectOpt && (
                                <CheckCircle className="w-4 h-4 text-emerald-700" />
                              )}
                              {practiceSubmitted && isSelected && !isCorrectOpt && (
                                <XCircle className="w-4 h-4 text-rose-700" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Submission / Verification Box */}
                      <div className="pt-2">
                        {!practiceSubmitted ? (
                          <button
                            onClick={() => {
                              if (selectedPracticeOption) setPracticeSubmitted(true);
                            }}
                            disabled={!selectedPracticeOption}
                            className="w-full sm:w-auto px-5 py-2 bg-teal-800 text-white text-xs font-semibold rounded-lg hover:bg-teal-900 disabled:opacity-50 transition-all shadow-xs"
                          >
                            Check Answer
                          </button>
                        ) : (
                          <div className="space-y-3 pt-2">
                            <div
                              className={`p-3 rounded-lg text-xs border ${
                                selectedPracticeOption === tutorResponse.practice_question.correct_option
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                  : 'bg-rose-50 border-rose-200 text-rose-950'
                              }`}
                            >
                              <div className="font-bold mb-1 flex items-center gap-1.5">
                                {selectedPracticeOption === tutorResponse.practice_question.correct_option ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                                    <span>Correct! Great mastery of the concept.</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-4 h-4 text-rose-700" />
                                    <span>
                                      Not quite. The correct answer is: {tutorResponse.practice_question.correct_option}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-[11px] text-stone-700 leading-relaxed">
                                {tutorResponse.practice_question.explanation}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedPracticeOption(null);
                                setPracticeSubmitted(false);
                              }}
                              className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition-all"
                            >
                              Try Question Again
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
