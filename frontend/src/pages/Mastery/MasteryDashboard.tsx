import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { masteryApi, getApiErrorMessage } from '../../services/api';
import { MasteryInputResponse, TopicMasteryAgg } from '../../types';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AlertBanner } from '../../components/common/AlertBanner';
import { StatCard } from '../../components/common/StatCard';
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Layers,
  Search,
  Check,
} from 'lucide-react';

interface MasteryDashboardProps {
  initialAttemptId?: number | null;
}

export const MasteryDashboard: React.FC<MasteryDashboardProps> = ({ initialAttemptId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryAttemptId = searchParams.get('attempt_id')
    ? Number(searchParams.get('attempt_id'))
    : null;

  const [attemptIdInput, setAttemptIdInput] = useState<number>(
    queryAttemptId || initialAttemptId || 1
  );
  const [masteryData, setMasteryData] = useState<MasteryInputResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTopicQuery, setSearchTopicQuery] = useState<string>('');

  useEffect(() => {
    const idToFetch = queryAttemptId || initialAttemptId || attemptIdInput;
    setAttemptIdInput(idToFetch);
    loadMastery(idToFetch);
  }, [queryAttemptId, initialAttemptId]);

  const loadMastery = async (id: number) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await masteryApi.getMasteryInput(id);
      setMasteryData(data);
    } catch (err) {
      setErrorMessage(
        `Failed to fetch mastery input for Attempt #${id}. ${getApiErrorMessage(err)}`
      );
      setMasteryData(null);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!masteryData || !masteryData.responses || masteryData.responses.length === 0) {
      return null;
    }

    const total = masteryData.responses.length;
    const correct = masteryData.responses.filter((r) => r.is_correct === true).length;
    const accuracy = Math.round((correct / total) * 100);

    const totalTime = masteryData.responses.reduce(
      (acc, curr) => acc + (curr.response_time_seconds || 0),
      0
    );
    const avgTime = Math.round(totalTime / total);

    return {
      total,
      correct,
      incorrect: total - correct,
      accuracy,
      avgTime,
      score: masteryData.score,
    };
  }, [masteryData]);

  const topicMasteryList: TopicMasteryAgg[] = useMemo(() => {
    if (!masteryData || !masteryData.responses) return [];

    const topicMap = new Map<
      number,
      {
        topic_id: number;
        topic_name: string;
        chapter_name: string;
        subject_name: string;
        total: number;
        correct: number;
        total_time: number;
      }
    >();

    masteryData.responses.forEach((r) => {
      const current = topicMap.get(r.topic_id) || {
        topic_id: r.topic_id,
        topic_name: r.topic || `Topic #${r.topic_id}`,
        chapter_name: r.chapter || '—',
        subject_name: r.subject || '—',
        total: 0,
        correct: 0,
        total_time: 0,
      };

      current.total += 1;
      if (r.is_correct) current.correct += 1;
      current.total_time += r.response_time_seconds || 0;

      topicMap.set(r.topic_id, current);
    });

    return Array.from(topicMap.values()).map((item) => {
      const accuracy = Math.round((item.correct / item.total) * 100);
      let status: 'Mastered' | 'Developing' | 'Needs Review' = 'Needs Review';
      if (accuracy >= 80) status = 'Mastered';
      else if (accuracy >= 50) status = 'Developing';

      return {
        topic_id: item.topic_id,
        topic_name: item.topic_name,
        chapter_name: item.chapter_name,
        subject_name: item.subject_name,
        total_questions: item.total,
        correct_count: item.correct,
        accuracy,
        avg_time_seconds: Math.round(item.total_time / item.total),
        status,
      };
    });
  }, [masteryData]);

  const filteredTopicMastery = topicMasteryList.filter(
    (t) =>
      t.topic_name.toLowerCase().includes(searchTopicQuery.toLowerCase()) ||
      t.chapter_name.toLowerCase().includes(searchTopicQuery.toLowerCase()) ||
      t.subject_name.toLowerCase().includes(searchTopicQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
              <BarChart3 className="w-3.5 h-3.5" /> Mastery Engine
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              Mastery & Learning Velocity
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Inspect student knowledge mastery mapped through <span className="font-mono text-stone-800">Topic → Chapter → Subject → Class</span>.
            </p>
          </div>

          {/* Attempt Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-stone-100 p-1.5 rounded-lg border border-stone-200/80 text-xs w-full sm:w-auto justify-between">
              <span className="font-medium text-stone-600 px-1 text-[11px]">Attempt ID:</span>
              <input
                type="number"
                min={1}
                value={attemptIdInput}
                onChange={(e) => setAttemptIdInput(Number(e.target.value))}
                className="w-14 px-2 py-1 bg-white border border-stone-300 rounded font-mono text-center font-bold text-stone-800 text-xs"
              />
              <button
                onClick={() => {
                  setSearchParams({ attempt_id: attemptIdInput.toString() });
                  loadMastery(attemptIdInput);
                }}
                className="px-3 py-1 bg-teal-800 text-white rounded font-medium hover:bg-teal-900 text-xs"
              >
                Inspect
              </button>
            </div>
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
        <div className="bg-white p-10 sm:p-12 rounded-xl border border-stone-200/80 text-center shadow-xs">
          <LoadingSpinner label="Evaluating mastery telemetry & aggregating metrics..." />
        </div>
      ) : !masteryData ? (
        <div className="bg-white p-10 sm:p-12 rounded-xl border border-stone-200/80 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-stone-800 text-sm">No Mastery Telemetry Found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            No attempt records found for Attempt #{attemptIdInput}. Complete an assessment first in the <strong>Quiz Runner</strong>.
          </p>
        </div>
      ) : (
        <>
          {/* Top High-Level Stat Cards */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                title="Overall Score"
                value={`${stats.score}%`}
                subtitle={masteryData.completed ? 'Attempt completed' : 'In-progress'}
                icon={Award}
                colorScheme="teal"
              />
              <StatCard
                title="Accuracy Rate"
                value={`${stats.accuracy}%`}
                subtitle={`${stats.correct} correct of ${stats.total}`}
                icon={CheckCircle2}
                colorScheme="emerald"
              />
              <StatCard
                title="Avg Response Latency"
                value={`${stats.avgTime}s`}
                subtitle="Per question velocity"
                icon={Clock}
                colorScheme="amber"
              />
              <StatCard
                title="Topics Evaluated"
                value={topicMasteryList.length}
                subtitle="Distinct syllabus topics"
                icon={Layers}
                colorScheme="stone"
              />
            </div>
          )}

          {/* Topic-Level Pedagogical Mastery Breakdown */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <h2 className="font-bold text-sm text-stone-900 uppercase tracking-wide">
                  Topic-Level Mastery Telemetry
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Performance aggregated by syllabus topic with calculated mastery indices.
                </p>
              </div>

              {/* Topic Search Input */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Filter by topic or chapter..."
                  value={searchTopicQuery}
                  onChange={(e) => setSearchTopicQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-teal-800 w-full text-stone-900"
                />
              </div>
            </div>

            {filteredTopicMastery.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs">
                No matching topic mastery records.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredTopicMastery.map((tm) => (
                  <div
                    key={tm.topic_id}
                    className="p-3.5 sm:p-4 rounded-xl border border-stone-200/80 bg-stone-50/50 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-medium text-teal-800 uppercase tracking-wider block">
                          {tm.subject_name} • {tm.chapter_name}
                        </span>
                        <h4 className="text-xs font-bold text-stone-900 mt-0.5 leading-snug">
                          {tm.topic_name}
                        </h4>
                      </div>

                      <Badge
                        variant={
                          tm.status === 'Mastered'
                            ? 'emerald'
                            : tm.status === 'Developing'
                            ? 'amber'
                            : 'rose'
                        }
                        size="sm"
                      >
                        {tm.status}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-500 font-medium">Mastery Index:</span>
                        <span className="font-bold text-stone-900">{tm.accuracy}%</span>
                      </div>
                      <div className="w-full bg-stone-200/80 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            tm.accuracy >= 80
                              ? 'bg-teal-700'
                              : tm.accuracy >= 50
                              ? 'bg-amber-600'
                              : 'bg-rose-600'
                          }`}
                          style={{ width: `${tm.accuracy}%` }}
                        />
                      </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px] text-stone-500 font-mono">
                      <span>
                        Correct: <strong className="text-stone-800">{tm.correct_count}/{tm.total_questions}</strong>
                      </span>
                      <span>
                        Avg Speed: <strong className="text-stone-800">{tm.avg_time_seconds}s</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Question-by-Question Response Audit */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs p-4 sm:p-6 space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h2 className="font-bold text-sm text-stone-900 uppercase tracking-wide">
                Detailed Response Logs ({masteryData.responses.length})
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Every individual student response mapped to its academic hierarchy node.
              </p>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-600 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Resp #</th>
                    <th className="py-2.5 px-3">Subject & Chapter</th>
                    <th className="py-2.5 px-3">Topic</th>
                    <th className="py-2.5 px-3">Question ID</th>
                    <th className="py-2.5 px-3">Latency</th>
                    <th className="py-2.5 px-3 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {masteryData.responses.map((resp) => (
                    <tr key={resp.response_id} className="hover:bg-stone-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-stone-500">#{resp.response_id}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-stone-900">
                          {resp.subject || '—'}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {resp.chapter || '—'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-stone-800">
                        {resp.topic}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-stone-500">
                        Q#{resp.question_id}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-stone-600">
                        {resp.response_time_seconds ? `${resp.response_time_seconds}s` : '—'}
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
        </>
      )}
    </div>
  );
};
