import React, { useEffect, useState } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { tutorApi, assessmentApi, masteryApi, getApiErrorMessage } from '../../services/api';
import { TutorContext, TutorResponse, AttemptSummaryItem, QuizTutorResponse } from '../../types';
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

  // Mode: 'mistakes' (from quiz attempt) or 'ask_custom' (direct questions)
  const [activeTab, setActiveTab] = useState<'mistakes' | 'ask_custom'>('mistakes');

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
  const [quizSummaryResponse, setQuizSummaryResponse] = useState<QuizTutorResponse | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState<boolean>(false);

  // Attempt Multi-Mistake Navigation (if arriving from Quiz attempt)
  const [mistakeList, setMistakeList] = useState<TutorContext[]>([]);
  const [selectedMistakeIndex, setSelectedMistakeIndex] = useState<number>(0);
  const [activeAttemptTitle, setActiveAttemptTitle] = useState<string>('');

  // Interactive Practice Question State
  const [selectedPracticeOption, setSelectedPracticeOption] = useState<string | null>(null);
  const [practiceSubmitted, setPracticeSubmitted] = useState<boolean>(false);

  // Manual Testing & Direct Context Entry State
  const [manualTopicName, setManualTopicName] = useState('Triangles Similarity');
  const [manualQuestionText, setManualQuestionText] = useState('Which condition proves two triangles similar?');
  const [manualLearnerAnswer, setManualLearnerAnswer] = useState('Equal Area');
  const [manualCorrectAnswer, setManualCorrectAnswer] = useState('AA (Angle-Angle) Similarity Criterion');
  const [manualGap, setManualGap] = useState('Confusing congruence area equality with similarity proportionality.');

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
            try {
        const mode2Res = await tutorApi.explainAttemptViaBackend(attemptId);
        setQuizSummaryResponse(mode2Res);
      } catch (e) {
        console.warn("Could not load Mode 2 quiz summary:", e);
      }
      const masteryData = await masteryApi.getMasteryInput(attemptId);
      const assessData = await assessmentApi.getAssessment(masteryData.assessment_id);
      setActiveAttemptTitle(assessData.title);

      // Filter incorrect questions
      const incorrectResponses = masteryData.responses.filter((r) => r.is_correct === false);
      const contexts: TutorContext[] = [];

      for (const resp of incorrectResponses) {
        const matchingQ = assessData.questions.find((q) => q.question_id === resp.question_id);
        if (matchingQ && matchingQ.options.length >= 2) {
          // 1. Find the actual correct option text
          const correctOptObj = matchingQ.options.find((o) => o.is_correct === true) || matchingQ.options[0];
          const correctOptText = correctOptObj.option_text;

          // 2. Find the actual learner selected option text
          let selectedOptText = 'Alternate Conception';
          if (resp.selected_option_id) {
            const chosen = matchingQ.options.find((o) => o.id === resp.selected_option_id);
            if (chosen) selectedOptText = chosen.option_text;
          } else {
            const distractor = matchingQ.options.find((o) => o.option_text !== correctOptText);
            if (distractor) selectedOptText = distractor.option_text;
          }

          contexts.push({
            competency: {
              id: `topic_${resp.topic_id}`,
              name: resp.topic || 'Syllabus Topic',
            },
            question: {
              id: `q_${resp.question_id}`,
              text: matchingQ.question_text,
              options: matchingQ.options.map((o) => o.option_text),
            },
            learner_answer: selectedOptText,
            correct_answer: correctOptText,
            detected_gap: {
              description: `Learner selected '${selectedOptText}' instead of '${correctOptText}' on ${resp.topic || 'this topic'}.`,
            },
          });
        }
      }

      setMistakeList(contexts);
      setActiveTab('mistakes');
      if (contexts.length > 0) {
        setSelectedMistakeIndex(0);
        setActiveContext(contexts[0]);
        await fetchExplanation(contexts[0]);
      } else {
        setErrorMessage('All questions in this attempt were answered correctly! No mistakes detected.');
      }
    } catch (err) {
      setErrorMessage(`Failed to load attempt mistakes. ${getApiErrorMessage(err)}`);
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

  // Handle Manual Form Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const topicClean = manualTopicName.trim() || 'General Mathematics';
    const questionClean = manualQuestionText.trim();
    const learnerAnswerClean = manualLearnerAnswer.trim();
    const correctAnswerClean = manualCorrectAnswer.trim();
    const gapClean = manualGap.trim();

    const ctx: TutorContext = {
      competency: {
        id: topicClean.toLowerCase().replace(/\s+/g, '_'),
        name: topicClean,
      },
      question: {
        id: `q_manual_${Date.now()}`,
        text: questionClean,
        options: [
          correctAnswerClean,
          learnerAnswerClean,
          `Alternative option in ${topicClean}`,
          `Distractor option in ${topicClean}`,
        ],
      },
      learner_answer: learnerAnswerClean,
      correct_answer: correctAnswerClean,
      detected_gap: gapClean ? { description: gapClean } : null,
    };

    setActiveContext(ctx);
    fetchExplanation(ctx);
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
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 border border-stone-200"
              >
                <History className="w-3.5 h-3.5" />
                <span>All Attempts Hub</span>
              </button>
            )}

            <Badge
              variant={tutorOnline ? 'emerald' : tutorOnline === false ? 'rose' : 'stone'}
              size="sm"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{tutorOnline ? 'AI Tutor Online' : 'AI Tutor Connecting...'}</span>
            </Badge>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {recentAttempts.map((att) => {
                  const isPerfect = att.wrong_count === 0 && att.completed;
                  return (
                    <div
                      key={att.id}
                      className="bg-stone-50/80 border border-stone-200 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-teal-600/60 hover:bg-white transition-all shadow-2xs group"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="stone" size="sm">
                            Class {att.class_level}
                          </Badge>
                          <Badge variant={att.score >= 80 ? 'emerald' : att.score >= 50 ? 'teal' : 'rose'} size="sm">
                            Score: {att.score}%
                          </Badge>
                        </div>

                        <h3 className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-teal-900 transition-colors">
                          {att.assessment_title}
                        </h3>

                        <div className="flex items-center gap-3 text-[11px] text-stone-500">
                          <span>Attempt #{att.id}</span>
                          <span>•</span>
                          <span>{att.total_questions} Questions</span>
                          <span>•</span>
                          <span className={att.wrong_count > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                            {att.wrong_count > 0 ? `${att.wrong_count} Mistakes` : '100% Correct'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectAttemptFromHub(att.id)}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
                          att.wrong_count > 0
                            ? 'bg-stone-900 text-white hover:bg-stone-800'
                            : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>{att.wrong_count > 0 ? `Review ${att.wrong_count} Mistakes with AI Tutor` : 'Review Questions with AI Tutor'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
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
            {/* Left Column: Context Card / Manual Input (4 cols) */}
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
                  {mistakeList.length > 0 && activeTab === 'mistakes' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('ask_custom')}
                      className="text-[11px] font-semibold text-teal-800 hover:text-teal-950 transition-colors"
                    >
                      + Manual Entry
                    </button>
                  )}
                  {mistakeList.length > 0 && activeTab === 'ask_custom' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('mistakes')}
                      className="text-[11px] font-semibold text-teal-800 hover:text-teal-950 transition-colors"
                    >
                      ← Back to Mistakes
                    </button>
                  )}
                </div>

                {/* TAB 1: Quiz Attempt Mistake View */}
                {activeTab === 'mistakes' && activeContext ? (
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
                ) : (
                  /* TAB 2: Direct Context / Manual Entry Form */
                  <form onSubmit={handleManualSubmit} className="space-y-3.5 text-xs">
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      Enter an assessment context or question to get an instant AI Socratic lesson:
                    </p>

                    <div>
                      <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                        Topic / Competency
                      </label>
                      <input
                        type="text"
                        value={manualTopicName}
                        onChange={(e) => setManualTopicName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                        placeholder="e.g. Triangles Similarity, Real Numbers"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                        Question Text
                      </label>
                      <textarea
                        rows={2}
                        value={manualQuestionText}
                        onChange={(e) => setManualQuestionText(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800 leading-relaxed"
                        placeholder="e.g. Which condition proves two triangles similar?"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                        Your Answer (Incorrect Choice)
                      </label>
                      <input
                        type="text"
                        value={manualLearnerAnswer}
                        onChange={(e) => setManualLearnerAnswer(e.target.value)}
                        className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                        placeholder="e.g. Equal Area"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                        Correct Answer
                      </label>
                      <input
                        type="text"
                        value={manualCorrectAnswer}
                        onChange={(e) => setManualCorrectAnswer(e.target.value)}
                        className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                        placeholder="e.g. AA (Angle-Angle) Similarity Criterion"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                        Specific Confusion / Detected Gap <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={manualGap}
                        onChange={(e) => setManualGap(e.target.value)}
                        className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                        placeholder="e.g. Confused area equality with similarity proportionality"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loadingExplanation || !manualQuestionText.trim()}
                      className="w-full py-2.5 bg-teal-800 text-white font-semibold rounded-lg text-xs hover:bg-teal-900 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>Explain This Mistake</span>
                    </button>
                  </form>
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
                    <div className="text-xs sm:text-sm text-stone-800 leading-relaxed bg-teal-50/40 p-3.5 rounded-lg border border-teal-100 font-mono whitespace-pre-line">
                      {tutorResponse.worked_example}
                    </div>
                  </div>

                  {/* Output 4: Interactive Adaptive Practice Question */}
                  <div className="bg-white rounded-xl border-2 border-teal-600/60 shadow-md p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <h3 className="font-bold text-xs sm:text-sm text-stone-900 uppercase tracking-wide">
                          Reinforcement Practice Question
                        </h3>
                      </div>
                      <Badge variant="teal" size="sm">
                        Adaptive Test
                      </Badge>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-stone-900 leading-relaxed">
                      {tutorResponse.practice_question.question}
                    </p>

                    {/* Practice Options */}
                    <div className="space-y-2">
                      {tutorResponse.practice_question.options.map((opt, idx) => {
                        const isSelected = selectedPracticeOption === opt;
                        const isCorrect = opt === tutorResponse.practice_question.correct_option;
                        const letter = String.fromCharCode(65 + idx);

                        let buttonClass = 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50';
                        if (practiceSubmitted) {
                          if (isCorrect) {
                            buttonClass = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold ring-1 ring-emerald-500';
                          } else if (isSelected && !isCorrect) {
                            buttonClass = 'bg-rose-50 border-rose-400 text-rose-950 font-medium';
                          }
                        } else if (isSelected) {
                          buttonClass = 'bg-teal-50 border-teal-600 text-teal-950 ring-1 ring-teal-600 font-semibold';
                        }

                        return (
                          <button
                            key={idx}
                            disabled={practiceSubmitted}
                            onClick={() => setSelectedPracticeOption(opt)}
                            className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center gap-3 ${buttonClass}`}
                          >
                            <span className="w-6 h-6 rounded-lg bg-stone-100 flex items-center justify-center font-mono font-bold text-stone-600 text-xs">
                              {letter}
                            </span>
                            <span className="flex-1 leading-snug">{opt}</span>
                            {practiceSubmitted && isCorrect && (
                              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            )}
                            {practiceSubmitted && isSelected && !isCorrect && (
                              <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Practice Action & Explanation */}
                    {!practiceSubmitted ? (
                      <button
                        onClick={() => setPracticeSubmitted(true)}
                        disabled={!selectedPracticeOption}
                        className="w-full py-2.5 bg-teal-800 text-white rounded-lg text-xs font-semibold hover:bg-teal-900 disabled:opacity-50 transition-all shadow-xs"
                      >
                        Check Practice Answer
                      </button>
                    ) : (
                      <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-2">
                        <div className="flex items-center gap-1.5 font-bold">
                          {selectedPracticeOption === tutorResponse.practice_question.correct_option ? (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" /> Correct! Excellent understanding.
                            </span>
                          ) : (
                            <span className="text-rose-700 flex items-center gap-1">
                              <XCircle className="w-4 h-4" /> Not quite right. Here is the breakdown:
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-600 leading-relaxed">
                          {tutorResponse.practice_question.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
