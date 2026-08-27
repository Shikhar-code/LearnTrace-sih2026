import React, { useEffect, useState } from 'react';
import { academicApi, getApiErrorMessage } from '../../services/api';
import { AcademicClass, Subject, Chapter, Topic } from '../../types';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AlertBanner } from '../../components/common/AlertBanner';
import {
  BookOpen,
  ChevronRight,
  FolderTree,
  Plus,
  Sparkles,
} from 'lucide-react';

export const CurriculumExplorer: React.FC = () => {
  // State for Academic Hierarchy
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [selectedClassLevel, setSelectedClassLevel] = useState<number | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  // Quick topic creation form
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [creatingTopic, setCreatingTopic] = useState(false);

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Initial load: fetch classes
  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await academicApi.getClasses();
      const filtered = data.filter((c) => c.class_level === 9 || c.class_level === 10);
      setClasses(filtered);
      if (filtered.length > 0) {
        const defaultClass = filtered.find((c) => c.class_level === 10) || filtered[0];
        setSelectedClassLevel(defaultClass.class_level);
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch subjects whenever selectedClassLevel changes
  useEffect(() => {
    if (selectedClassLevel === null) return;
    loadSubjects(selectedClassLevel);
  }, [selectedClassLevel]);

  const loadSubjects = async (classLevel: number) => {
    setLoading(true);
    setErrorMessage(null);
    setSubjects([]);
    setSelectedSubject(null);
    setChapters([]);
    setSelectedChapter(null);
    setTopics([]);
    setSelectedTopic(null);
    try {
      const data = await academicApi.getSubjects(classLevel);
      setSubjects(data);
      if (data.length > 0) {
        setSelectedSubject(data[0]);
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch chapters whenever selectedSubject changes
  useEffect(() => {
    if (!selectedSubject) return;
    loadChapters(selectedSubject.id);
  }, [selectedSubject]);

  const loadChapters = async (subjectId: number) => {
    setErrorMessage(null);
    setChapters([]);
    setSelectedChapter(null);
    setTopics([]);
    setSelectedTopic(null);
    try {
      const data = await academicApi.getChapters(subjectId);
      setChapters(data);
      if (data.length > 0) {
        setSelectedChapter(data[0]);
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  };

  // 4. Fetch topics whenever selectedChapter changes
  useEffect(() => {
    if (!selectedChapter) return;
    loadTopics(selectedChapter.id);
  }, [selectedChapter]);

  const loadTopics = async (chapterId: number) => {
    setErrorMessage(null);
    setTopics([]);
    setSelectedTopic(null);
    try {
      const data = await academicApi.getTopics(chapterId);
      setTopics(data);
      if (data.length > 0) {
        setSelectedTopic(data[0]);
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChapter || !newTopicTitle.trim()) return;

    setCreatingTopic(true);
    setErrorMessage(null);
    try {
      const result = await academicApi.createTopic(selectedChapter.id, newTopicTitle.trim());
      setSuccessMessage(`Topic "${result.title}" created successfully!`);
      setNewTopicTitle('');
      setIsAddingTopic(false);
      await loadTopics(selectedChapter.id);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setCreatingTopic(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
              <FolderTree className="w-3.5 h-3.5" /> Academic Taxonomy
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              Curriculum & Syllabus Explorer
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Browse official NCERT chapters and topics across classes and subjects.
            </p>
          </div>

          {/* Class Switcher Buttons */}
          <div className="flex items-center gap-1.5 bg-stone-100/80 p-1.5 rounded-lg border border-stone-200/70 overflow-x-auto">
            <span className="text-[11px] font-medium text-stone-500 px-1.5 flex-shrink-0">Grade:</span>
            {classes.length === 0 ? (
              <span className="text-xs text-stone-400">Loading...</span>
            ) : (
              classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassLevel(c.class_level)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedClassLevel === c.class_level
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'text-stone-600 hover:bg-white hover:text-stone-900'
                  }`}
                >
                  Class {c.class_level}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Breadcrumb Path */}
        <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-medium text-stone-600">
          <span className="text-stone-400 font-mono text-[10px] sm:text-[11px]">Path:</span>
          <span className="font-semibold text-stone-800">Class {selectedClassLevel ?? '—'}</span>
          <ChevronRight className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
          <span className="font-semibold text-teal-800">{selectedSubject?.name || 'Select Subject'}</span>
          {selectedChapter && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
              <span className="font-semibold text-stone-800 truncate max-w-[180px] sm:max-w-xs">{selectedChapter.title}</span>
            </>
          )}
          {selectedTopic && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
              <Badge variant="teal" size="sm" className="truncate max-w-[180px] sm:max-w-xs">
                {selectedTopic.title}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <AlertBanner
          type="error"
          title="Curriculum Notice"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
      {successMessage && (
        <AlertBanner
          type="success"
          title="Success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Subject Tabs - horizontally scrollable on small screens */}
      {subjects.length > 0 && (
        <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSubject(s)}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedSubject?.id === s.id
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* 2-Column Responsive Layout: Chapters (5 cols) & Topics (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Column 1: Chapters (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-stone-200/80 shadow-xs flex flex-col h-auto min-h-[300px] max-h-[480px] lg:h-[620px] lg:max-h-none">
          <div className="p-4 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-800" />
              <h2 className="font-semibold text-xs text-stone-900 uppercase tracking-wide">
                Chapters ({chapters.length})
              </h2>
            </div>
            {selectedSubject && (
              <Badge variant="stone" size="sm">
                {selectedSubject.name}
              </Badge>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {loading ? (
              <LoadingSpinner label="Loading chapters..." />
            ) : chapters.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-xs">
                No chapters found for this subject.
              </div>
            ) : (
              chapters.map((chapter, idx) => {
                const isSelected = selectedChapter?.id === chapter.id;
                return (
                  <button
                    key={chapter.id}
                    onClick={() => setSelectedChapter(chapter)}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-stone-100 border-stone-400 text-stone-900 font-semibold shadow-2xs'
                        : 'bg-white border-stone-200/70 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono flex-shrink-0 ${
                        isSelected ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 leading-snug break-words">
                      {chapter.title}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Topics in Chapter (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-stone-200/80 shadow-xs flex flex-col h-auto min-h-[300px] max-h-[480px] lg:h-[620px] lg:max-h-none">
          <div className="p-4 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700" />
              <h2 className="font-semibold text-xs text-stone-900 uppercase tracking-wide">
                Topics {selectedChapter && `in "${selectedChapter.title}"`} ({topics.length})
              </h2>
            </div>
            
            {selectedChapter && (
              <button
                onClick={() => setIsAddingTopic(!isAddingTopic)}
                className="text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-lg border border-stone-200 flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Topic
              </button>
            )}
          </div>

          {/* Inline Add Topic Form */}
          {isAddingTopic && selectedChapter && (
            <form onSubmit={handleCreateTopic} className="p-3.5 bg-stone-50 border-b border-stone-200">
              <label className="text-[11px] font-semibold text-stone-800 block mb-1">
                Add New Topic to "{selectedChapter.title}"
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="e.g. Fundamental Theorem of Arithmetic"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-700"
                  required
                />
                <button
                  type="submit"
                  disabled={creatingTopic || !newTopicTitle.trim()}
                  className="px-3.5 py-1.5 bg-teal-800 text-white rounded-md text-xs font-medium hover:bg-teal-900 disabled:opacity-50"
                >
                  {creatingTopic ? 'Adding...' : 'Save Topic'}
                </button>
              </div>
            </form>
          )}

          {/* Topics List */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
            {!selectedChapter ? (
              <div className="text-center py-16 text-stone-400 text-xs">
                Select a chapter from the left to explore its topics.
              </div>
            ) : topics.length === 0 ? (
              <div className="text-center py-16 text-stone-400 text-xs">
                No topics found in this chapter yet. Click <strong>"Add Topic"</strong> above to create one.
              </div>
            ) : (
              topics.map((topic, idx) => {
                const isSelected = selectedTopic?.id === topic.id;
                return (
                  <div
                    key={topic.id}
                    onClick={() => setSelectedTopic(topic)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-400 text-teal-950 ring-1 ring-teal-300 shadow-2xs'
                        : 'bg-white border-stone-200/80 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 ${
                          isSelected ? 'bg-teal-800 text-white' : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-stone-900 font-bold text-xs sm:text-sm">
                          {topic.title}
                        </div>
                        <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                          topic_id: #{topic.id} • {selectedChapter.title}
                        </div>
                      </div>
                    </div>

                    <Badge variant={isSelected ? "teal" : "stone"} size="sm">
                      Topic #{topic.id}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
