import React, { useEffect, useState } from 'react';
import { documentsApi, academicApi, getApiErrorMessage } from '../../services/api';
import {
  SourceDocument,
  DocumentChunk,
  AcademicClass,
  Subject,
  Chapter,
  Topic,
} from '../../types';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AlertBanner } from '../../components/common/AlertBanner';
import {
  UploadCloud,
  FileText,
  Layers,
  CheckSquare,
  Square,
  Search,
  Filter,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

export const PdfIngestion: React.FC = () => {
  // Document Catalogue State
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<SourceDocument | null>(null);
  const [filterClass, setFilterClass] = useState<number | undefined>(undefined);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);

  // Upload Form State
  const [file, setFile] = useState<File | null>(null);
  const [uploadClassLevel, setUploadClassLevel] = useState<number>(10);
  const [uploadSubjectName, setUploadSubjectName] = useState<string>('Mathematics');
  const [uploadChapterTitle, setUploadChapterTitle] = useState<string>('');
  const [uploadSourceName, setUploadSourceName] = useState<string>('NCERT');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Chunks State for selected document
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState<boolean>(false);
  const [selectedChunkIds, setSelectedChunkIds] = useState<number[]>([]);
  const [chunkSearchQuery, setChunkSearchQuery] = useState<string>('');
  const [chunkFilterStatus, setChunkFilterStatus] = useState<'all' | 'unmapped' | 'mapped'>('all');

  // Hierarchy Selection for Bulk Mapping Target
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [targetClassLevel, setTargetClassLevel] = useState<number>(10);
  const [targetSubjects, setTargetSubjects] = useState<Subject[]>([]);
  const [targetSubjectId, setTargetSubjectId] = useState<number | null>(null);
  const [targetChapters, setTargetChapters] = useState<Chapter[]>([]);
  const [targetChapterId, setTargetChapterId] = useState<number | null>(null);
  const [targetTopics, setTargetTopics] = useState<Topic[]>([]);
  const [targetTopicId, setTargetTopicId] = useState<number | null>(null);

  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Initial Load: Catalogue and Classes
  useEffect(() => {
    loadCatalogue();
    loadClasses();
  }, []);

  const loadCatalogue = async (classLevel?: number) => {
    setLoadingDocs(true);
    setErrorMessage(null);
    try {
      const docs = await documentsApi.getCatalogue(classLevel);
      setDocuments(docs);
      if (docs.length > 0) {
        // Prefer first processed document or current selection
        setSelectedDocument((prev) => {
          if (prev) {
            const updated = docs.find((d) => d.id === prev.id);
            if (updated) return updated;
          }
          return docs.find((d) => d.status === 'processed') || docs[0];
        });
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadClasses = async () => {
    try {
      const data = await academicApi.getClasses();
      setClasses(data);
      if (data.length > 0) {
        setUploadClassLevel(data[0].class_level);
        setTargetClassLevel(data[0].class_level);
      }
    } catch (err) {
      console.warn('Could not load classes:', err);
    }
  };

  // 2. Chunks loader for selected document
  useEffect(() => {
    if (!selectedDocument) {
      setChunks([]);
      setSelectedChunkIds([]);
      return;
    }
    loadChunks(selectedDocument.id);
  }, [selectedDocument]);

  const loadChunks = async (documentId: number) => {
    setLoadingChunks(true);
    setSelectedChunkIds([]);
    try {
      const data = await documentsApi.getChunks(documentId);
      setChunks(data);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setLoadingChunks(false);
    }
  };

  // 3. Cascade for Target Topic Picker
  useEffect(() => {
    if (targetClassLevel === null) return;
    const fetchSubjects = async () => {
      try {
        const subs = await academicApi.getSubjects(targetClassLevel);
        setTargetSubjects(subs);
        if (subs.length > 0) {
          setTargetSubjectId(subs[0].id);
        } else {
          setTargetSubjectId(null);
          setTargetChapters([]);
          setTargetTopics([]);
        }
      } catch (e) {
        console.warn(e);
      }
    };
    fetchSubjects();
  }, [targetClassLevel]);

  useEffect(() => {
    if (!targetSubjectId) return;
    const fetchChapters = async () => {
      try {
        const chaps = await academicApi.getChapters(targetSubjectId);
        setTargetChapters(chaps);
        if (chaps.length > 0) {
          setTargetChapterId(chaps[0].id);
        } else {
          setTargetChapterId(null);
          setTargetTopics([]);
        }
      } catch (e) {
        console.warn(e);
      }
    };
    fetchChapters();
  }, [targetSubjectId]);

  useEffect(() => {
    if (!targetChapterId) return;
    const fetchTopics = async () => {
      try {
        const tops = await academicApi.getTopics(targetChapterId);
        setTargetTopics(tops);
        if (tops.length > 0) {
          setTargetTopicId(tops[0].id);
        } else {
          setTargetTopicId(null);
        }
      } catch (e) {
        console.warn(e);
      }
    };
    fetchTopics();
  }, [targetChapterId]);

  // Handle File Upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please select a valid PDF file.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_name', uploadSourceName);
    formData.append('class_level', uploadClassLevel.toString());
    formData.append('subject_name', uploadSubjectName);
    if (uploadChapterTitle.trim()) {
      formData.append('chapter_title', uploadChapterTitle.trim());
    }

    try {
      const res = await documentsApi.uploadDocument(formData);
      setSuccessMessage(
        `Document uploaded successfully! Extracted ${res.pages_extracted} pages into ${res.chunks_created} chunks.`
      );
      setFile(null);
      setUploadChapterTitle('');
      const updatedDocs = await documentsApi.getCatalogue(filterClass);
      setDocuments(updatedDocs);
      const newDoc = updatedDocs.find((d) => d.id === res.document_id);
      if (newDoc) {
        setSelectedDocument(newDoc);
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  };

  // Chunk Selection Handlers
  const toggleChunkSelect = (chunkId: number) => {
    setSelectedChunkIds((prev) =>
      prev.includes(chunkId) ? prev.filter((id) => id !== chunkId) : [...prev, chunkId]
    );
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredChunks.map((c) => c.id);
    if (ids.every((id) => selectedChunkIds.includes(id))) {
      setSelectedChunkIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedChunkIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  // Bulk Assign Handler
  const handleBulkAssignTopic = async () => {
    if (selectedChunkIds.length === 0) {
      setErrorMessage('Please select at least one chunk to assign.');
      return;
    }
    if (!targetTopicId) {
      setErrorMessage('Please select a target topic.');
      return;
    }

    setIsAssigning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await documentsApi.bulkAssignChunksTopic(selectedChunkIds, targetTopicId);
      setSuccessMessage(
        `Successfully mapped ${res.chunks_updated} chunk(s) to topic "${res.topic}"!`
      );
      setSelectedChunkIds([]);
      if (selectedDocument) {
        await loadChunks(selectedDocument.id);
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsAssigning(false);
    }
  };

  // Filtered Chunks Computation
  const filteredChunks = chunks.filter((chunk) => {
    if (chunkFilterStatus === 'unmapped' && chunk.topic_id !== null) return false;
    if (chunkFilterStatus === 'mapped' && chunk.topic_id === null) return false;

    if (chunkSearchQuery.trim()) {
      return chunk.content.toLowerCase().includes(chunkSearchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Ingestion Header */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-[11px] uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" /> Content Pipeline
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              PDF Ingestion & Chunk Mapper
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Upload NCERT textbooks or chapters, review chunked text passages, and map them to curriculum topics.
            </p>
          </div>
          <button
            onClick={() => {
              loadCatalogue(filterClass);
              if (selectedDocument) loadChunks(selectedDocument.id);
            }}
            className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-all border border-stone-200/60 w-full sm:w-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <AlertBanner
          type="error"
          title="Operation Failed"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
      {successMessage && (
        <AlertBanner
          type="success"
          title="Completed"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Grid: Upload Card & Catalogue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Upload Form Card (4 cols on desktop) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <UploadCloud className="w-4 h-4 text-teal-800" />
            <div>
              <h2 className="font-semibold text-xs text-stone-900 uppercase tracking-wide">
                Upload PDF Document
              </h2>
              <p className="text-[11px] text-stone-500">Extracts text & generates chunk indices</p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Source Name
              </label>
              <input
                type="text"
                value={uploadSourceName}
                onChange={(e) => setUploadSourceName(e.target.value)}
                className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                placeholder="e.g. NCERT"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Class Level
                </label>
                <select
                  value={uploadClassLevel}
                  onChange={(e) => setUploadClassLevel(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none"
                >
                  <option value={9}>Class 9</option>
                  <option value={10}>Class 10</option>
                  <option value={11}>Class 11</option>
                  <option value={12}>Class 12</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Subject
                </label>
                <select
                  value={uploadSubjectName}
                  onChange={(e) => setUploadSubjectName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none"
                >
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Chapter Title (Optional)
              </label>
              <input
                type="text"
                value={uploadChapterTitle}
                onChange={(e) => setUploadChapterTitle(e.target.value)}
                className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                placeholder="e.g. Triangles"
              />
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">
                Select PDF File
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full px-2 py-1 text-[11px] file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-800 hover:file:bg-stone-200 bg-stone-50 border border-stone-300 rounded-lg cursor-pointer"
                required
              />
              {file && (
                <p className="text-[11px] text-stone-500 mt-1 truncate">
                  Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isUploading || !file}
              className="w-full py-2 bg-stone-900 text-white rounded-lg font-medium text-xs hover:bg-stone-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              {isUploading ? (
                <>
                  <LoadingSpinner size="sm" className="p-0 text-white" />
                  <span>Processing PDF...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Process Document</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Ingested Documents Catalogue (8 cols on desktop) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-teal-800" />
              <div>
                <h2 className="font-semibold text-xs text-stone-900 uppercase tracking-wide">
                  Document Catalogue ({documents.length})
                </h2>
                <p className="text-[11px] text-stone-500">Seeded NCERT textbooks & documents</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-500 text-[11px]">Filter:</span>
              <select
                value={filterClass ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setFilterClass(val);
                  loadCatalogue(val);
                }}
                className="px-2.5 py-1 bg-stone-50 border border-stone-300 rounded-md text-xs text-stone-700"
              >
                <option value="">All Classes</option>
                <option value={9}>Class 9</option>
                <option value={10}>Class 10</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto max-h-72 mt-3 w-full">
            {loadingDocs ? (
              <LoadingSpinner label="Loading catalogue..." />
            ) : documents.length === 0 ? (
              <div className="text-center py-10 text-stone-400 text-xs">
                No documents found in catalogue.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-600 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Class & Subject</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {documents.map((doc) => {
                    const isSelected = selectedDocument?.id === doc.id;
                    return (
                      <tr
                        key={doc.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-stone-100/90 font-medium' : 'hover:bg-stone-50'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono text-stone-500">#{doc.id}</td>
                        <td className="py-2.5 px-3 text-stone-900 max-w-xs truncate" title={doc.title}>
                          {doc.title}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Badge variant="stone" size="sm">
                            Class {doc.class_level} • {doc.subject}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={doc.status === 'processed' ? 'emerald' : 'amber'}
                            size="sm"
                          >
                            {doc.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedDocument(doc)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-stone-900 text-white'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            {isSelected ? 'Active' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Chunk Viewer & Bulk Topic Mapper Section */}
      <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="w-4 h-4 text-teal-800" />
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                Document Chunks
              </h2>
              {selectedDocument && (
                <Badge
                  variant={selectedDocument.status === 'processed' ? 'emerald' : 'amber'}
                  size="sm"
                >
                  {selectedDocument.status} ({chunks.length} chunks)
                </Badge>
              )}
            </div>
            
            {/* Quick Document Switcher */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-stone-600">Viewing Source:</span>
              <select
                value={selectedDocument?.id ?? ''}
                onChange={(e) => {
                  const doc = documents.find((d) => d.id === Number(e.target.value));
                  if (doc) setSelectedDocument(doc);
                }}
                className="px-2.5 py-1 bg-stone-100 border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:bg-white max-w-xs truncate"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    #{d.id} - {d.title} ({d.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search chunk text..."
                value={chunkSearchQuery}
                onChange={(e) => setChunkSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-teal-800 w-full sm:w-48 text-stone-900"
              />
            </div>

            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200/80 text-xs overflow-x-auto w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-stone-500 ml-1.5 flex-shrink-0" />
              <button
                onClick={() => setChunkFilterStatus('all')}
                className={`px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                  chunkFilterStatus === 'all' ? 'bg-white shadow-2xs text-stone-900' : 'text-stone-500'
                }`}
              >
                All ({chunks.length})
              </button>
              <button
                onClick={() => setChunkFilterStatus('unmapped')}
                className={`px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                  chunkFilterStatus === 'unmapped' ? 'bg-white shadow-2xs text-amber-800' : 'text-stone-500'
                }`}
              >
                Unmapped ({chunks.filter((c) => c.topic_id === null).length})
              </button>
              <button
                onClick={() => setChunkFilterStatus('mapped')}
                className={`px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                  chunkFilterStatus === 'mapped' ? 'bg-white shadow-2xs text-emerald-800' : 'text-stone-500'
                }`}
              >
                Mapped ({chunks.filter((c) => c.topic_id !== null).length})
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Assignment Bar */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAllFiltered}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-100"
              >
                {filteredChunks.length > 0 &&
                filteredChunks.every((c) => selectedChunkIds.includes(c.id)) ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-teal-800" /> Deselect All
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-stone-400" /> Select Filtered
                  </>
                )}
              </button>
              <Badge variant="stone" size="sm">
                {selectedChunkIds.length} Selected
              </Badge>
            </div>

            <span className="text-stone-300 hidden sm:inline">|</span>

            {/* Target Topic Cascading Selectors */}
            <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
              <span className="font-medium text-stone-600 text-[11px]">Target:</span>
              <select
                value={targetClassLevel}
                onChange={(e) => setTargetClassLevel(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-stone-300 rounded text-xs text-stone-800"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.class_level}>
                    Class {c.class_level}
                  </option>
                ))}
              </select>

              <select
                value={targetSubjectId ?? ''}
                onChange={(e) => setTargetSubjectId(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-stone-300 rounded text-xs text-stone-800"
              >
                {targetSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={targetChapterId ?? ''}
                onChange={(e) => setTargetChapterId(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-stone-300 rounded text-xs text-stone-800 max-w-[140px] sm:max-w-xs truncate"
              >
                {targetChapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
              </select>

              <select
                value={targetTopicId ?? ''}
                onChange={(e) => setTargetTopicId(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-stone-300 rounded text-xs max-w-[140px] sm:max-w-xs truncate font-medium text-stone-900"
              >
                {targetTopics.length === 0 ? (
                  <option value="">No topics in chapter</option>
                ) : (
                  targetTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <button
            onClick={handleBulkAssignTopic}
            disabled={isAssigning || selectedChunkIds.length === 0 || !targetTopicId}
            className="w-full sm:w-auto px-4 py-2 bg-teal-800 text-white rounded-lg text-xs font-medium hover:bg-teal-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            {isAssigning ? (
              <LoadingSpinner size="sm" className="p-0 text-white" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Assign {selectedChunkIds.length} Chunks to Topic</span>
          </button>
        </div>

        {/* Chunks List Cards */}
        {loadingChunks ? (
          <LoadingSpinner label="Loading document chunks..." />
        ) : filteredChunks.length === 0 ? (
          <div className="text-center py-10 text-stone-400 text-xs bg-stone-50 rounded-xl border border-stone-200">
            No chunks found matching the filter or document.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
            {filteredChunks.map((chunk) => {
              const isSelected = selectedChunkIds.includes(chunk.id);
              const isMapped = chunk.topic_id !== null;
              return (
                <div
                  key={chunk.id}
                  onClick={() => toggleChunkSelect(chunk.id)}
                  className={`p-3 sm:p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-300 shadow-2xs'
                      : 'bg-white border-stone-200/80 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-teal-800 focus:ring-teal-700 cursor-pointer"
                      />
                      <span className="font-mono text-[11px] font-semibold text-stone-800">
                        Chunk #{chunk.chunk_index + 1}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        Page {chunk.page_number}
                      </span>
                    </div>

                    {isMapped ? (
                      <Badge variant="emerald" size="sm">
                        Mapped (#{chunk.topic_id})
                      </Badge>
                    ) : (
                      <Badge variant="amber" size="sm">
                        Unmapped
                      </Badge>
                    )}
                  </div>

                  <p className="text-stone-700 text-[11px] leading-relaxed line-clamp-4 bg-stone-50/70 p-2 rounded-lg border border-stone-100">
                    {chunk.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
