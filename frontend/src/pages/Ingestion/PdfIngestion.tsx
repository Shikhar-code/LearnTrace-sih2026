import React, { useEffect, useState } from "react";
import {
  documentsApi,
  academicApi,
  getApiErrorMessage,
} from "../../services/api";
import {
  SourceDocument,
  DocumentChunk,
  AcademicClass,
  Subject,
  Chapter,
  Topic,
} from "../../types";
import { Badge } from "../../components/common/Badge";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { AlertBanner } from "../../components/common/AlertBanner";
import {
  UploadCloud,
  FileText,
  Layers,
  CheckSquare,
  Square,
  Search,
  RefreshCw,
  PlusCircle,
  BookOpen,
  Link,
  X,
} from "lucide-react";

export const PdfIngestion: React.FC = () => {
  // Document Catalogue State
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [selectedDocument, setSelectedDocument] =
    useState<SourceDocument | null>(null);
  const [filterClass, setFilterClass] = useState<number | undefined>(undefined);
  const [showUploadDrawer, setShowUploadDrawer] = useState<boolean>(false);

  // Upload Form State
  const [file, setFile] = useState<File | null>(null);
  const [uploadClassLevel, setUploadClassLevel] = useState<number>(10);
  const [uploadSubjectName, setUploadSubjectName] =
    useState<string>("Mathematics");
  const [uploadChapterTitle, setUploadChapterTitle] = useState<string>("");
  const [uploadSourceName, setUploadSourceName] = useState<string>("NCERT");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Chunks State for selected document
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState<boolean>(false);
  const [selectedChunkIds, setSelectedChunkIds] = useState<number[]>([]);
  const [chunkSearchQuery, setChunkSearchQuery] = useState<string>("");
  const [chunkFilterStatus, setChunkFilterStatus] = useState<
    "all" | "unmapped" | "mapped"
  >("all");

  // Hierarchy Selection for Bulk Mapping Target (Class -> Subject -> Chapter -> Topic)
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [targetClassLevel, setTargetClassLevel] = useState<number>(10);
  const [targetSubjects, setTargetSubjects] = useState<Subject[]>([]);
  const [targetSubjectId, setTargetSubjectId] = useState<number | null>(null);
  const [targetChapters, setTargetChapters] = useState<Chapter[]>([]);
  const [targetChapterId, setTargetChapterId] = useState<number | null>(null);
  const [targetTopics, setTargetTopics] = useState<Topic[]>([]);
  const [targetTopicId, setTargetTopicId] = useState<number | null>(null);

  // Add New Topic Modal State
  const [showNewTopicModal, setShowNewTopicModal] = useState<boolean>(false);
  const [newTopicTitle, setNewTopicTitle] = useState<string>("");
  const [isCreatingTopic, setIsCreatingTopic] = useState<boolean>(false);

  // Status Alerts & Operations
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Initial Load: Catalogue and Classes
  useEffect(() => {
    loadCatalogue();
    loadClasses();
  }, []);

  const loadCatalogue = async (classLevel?: number) => {
    setErrorMessage(null);
    try {
      const docs = await documentsApi.getCatalogue(classLevel);
      setDocuments(docs);
      if (docs.length > 0) {
        setSelectedDocument((prev) => {
          if (prev) {
            const updated = docs.find((d) => d.id === prev.id);
            if (updated) return updated;
          }
          return docs.find((d) => d.status === "processed") || docs[0];
        });
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
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
      console.warn("Could not load classes:", err);
    }
  };

  // 2. Chunks loader & Target Auto-Sync for selected document
  useEffect(() => {
    if (!selectedDocument) {
      setChunks([]);
      setSelectedChunkIds([]);
      return;
    }
    loadChunks(selectedDocument.id);
    syncTargetWithDocument(selectedDocument);
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

  // Auto-sync Class, Subject, Chapter and Topics based on selected source material
  const syncTargetWithDocument = async (doc: SourceDocument) => {
    try {
      const docClass = doc.class_level;
      setTargetClassLevel(docClass);

      // 1. Fetch subjects for the document's class
      const subs = await academicApi.getSubjects(docClass);
      setTargetSubjects(subs);

      const matchingSub =
        subs.find((s) => s.name.toLowerCase() === doc.subject.toLowerCase()) ||
        subs[0];

      if (matchingSub) {
        setTargetSubjectId(matchingSub.id);

        // 2. Fetch chapters for matching subject
        const chaps = await academicApi.getChapters(matchingSub.id);
        setTargetChapters(chaps);

        // 3. Try to match chapter from document title
        let matchedChap = chaps[0];
        if (doc.title) {
          const found = chaps.find((c) =>
            doc.title.toLowerCase().includes(c.title.toLowerCase()),
          );
          if (found) matchedChap = found;
        }

        if (matchedChap) {
          setTargetChapterId(matchedChap.id);
          const tops = await academicApi.getTopics(matchedChap.id);
          setTargetTopics(tops);
          if (tops.length > 0) {
            setTargetTopicId(tops[0].id);
          } else {
            setTargetTopicId(null);
          }
        } else {
          setTargetChapterId(null);
          setTargetTopics([]);
          setTargetTopicId(null);
        }
      }
    } catch (e) {
      console.warn("Could not auto-sync target with document:", e);
    }
  };

  // 3. Manual change cascades for Target Topic Picker
  const handleTargetClassChange = async (newClass: number) => {
    setTargetClassLevel(newClass);
    try {
      const subs = await academicApi.getSubjects(newClass);
      setTargetSubjects(subs);
      if (subs.length > 0) {
        setTargetSubjectId(subs[0].id);
        const chaps = await academicApi.getChapters(subs[0].id);
        setTargetChapters(chaps);
        if (chaps.length > 0) {
          setTargetChapterId(chaps[0].id);
          const tops = await academicApi.getTopics(chaps[0].id);
          setTargetTopics(tops);
          setTargetTopicId(tops.length > 0 ? tops[0].id : null);
        } else {
          setTargetChapterId(null);
          setTargetTopics([]);
          setTargetTopicId(null);
        }
      } else {
        setTargetSubjectId(null);
        setTargetChapters([]);
        setTargetTopics([]);
        setTargetTopicId(null);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleTargetSubjectChange = async (newSubId: number) => {
    setTargetSubjectId(newSubId);
    try {
      const chaps = await academicApi.getChapters(newSubId);
      setTargetChapters(chaps);
      if (chaps.length > 0) {
        setTargetChapterId(chaps[0].id);
        const tops = await academicApi.getTopics(chaps[0].id);
        setTargetTopics(tops);
        setTargetTopicId(tops.length > 0 ? tops[0].id : null);
      } else {
        setTargetChapterId(null);
        setTargetTopics([]);
        setTargetTopicId(null);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleTargetChapterChange = async (newChapId: number) => {
    setTargetChapterId(newChapId);
    try {
      const tops = await academicApi.getTopics(newChapId);
      setTargetTopics(tops);
      setTargetTopicId(tops.length > 0 ? tops[0].id : null);
    } catch (e) {
      console.warn(e);
    }
  };

  const refreshTopicsForChapter = async (
    chapterIdToLoad: number,
    selectTopicId?: number,
  ) => {
    try {
      const tops = await academicApi.getTopics(chapterIdToLoad);
      setTargetTopics(tops);
      if (selectTopicId) {
        setTargetTopicId(selectTopicId);
      } else if (tops.length > 0) {
        setTargetTopicId(tops[0].id);
      } else {
        setTargetTopicId(null);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Handle File Upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Please select a valid PDF file.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("source_name", uploadSourceName);
    formData.append("class_level", uploadClassLevel.toString());
    formData.append("subject_name", uploadSubjectName);
    if (uploadChapterTitle.trim()) {
      formData.append("chapter_title", uploadChapterTitle.trim());
    }

    try {
      const res = await documentsApi.uploadDocument(formData);
      setSuccessMessage(
        `Document uploaded successfully! Extracted ${res.pages_extracted} pages into ${res.chunks_created} chunks.`,
      );
      setFile(null);
      setUploadChapterTitle("");
      setShowUploadDrawer(false);
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

  // Handle Create New Topic Inline
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetChapterId) {
      setErrorMessage("Please select a chapter first before adding a topic.");
      return;
    }
    if (!newTopicTitle.trim()) {
      setErrorMessage("Please enter a topic title.");
      return;
    }

    setIsCreatingTopic(true);
    setErrorMessage(null);

    try {
      const res = await academicApi.createTopic(
        targetChapterId,
        newTopicTitle.trim(),
      );
      setSuccessMessage(`New topic "${res.title}" created successfully!`);
      setNewTopicTitle("");
      setShowNewTopicModal(false);
      // Refresh topics and select the new one
      await refreshTopicsForChapter(targetChapterId, res.topic_id);
    } catch (err) {
      setErrorMessage(`Failed to create topic. ${getApiErrorMessage(err)}`);
    } finally {
      setIsCreatingTopic(false);
    }
  };

  // Chunk Selection Handlers
  const toggleChunkSelect = (chunkId: number) => {
    setSelectedChunkIds((prev) =>
      prev.includes(chunkId)
        ? prev.filter((id) => id !== chunkId)
        : [...prev, chunkId],
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

  const handleSelectAllUnmapped = () => {
    const unmappedIds = chunks
      .filter((c) => c.topic_id === null)
      .map((c) => c.id);
    setSelectedChunkIds(unmappedIds);
  };

  // Bulk Assign Handler
  const handleBulkAssignTopic = async () => {
    if (selectedChunkIds.length === 0) {
      setErrorMessage("Please select at least one chunk to assign.");
      return;
    }
    if (!targetTopicId) {
      setErrorMessage("Please select a target topic.");
      return;
    }

    setIsAssigning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await documentsApi.bulkAssignChunksTopic(
        selectedChunkIds,
        targetTopicId,
      );
      setSuccessMessage(
        `Successfully mapped ${res.chunks_updated} chunk(s) to topic "${res.topic}"!`,
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
    if (chunkFilterStatus === "unmapped" && chunk.topic_id !== null)
      return false;
    if (chunkFilterStatus === "mapped" && chunk.topic_id === null) return false;

    if (chunkSearchQuery.trim()) {
      return chunk.content
        .toLowerCase()
        .includes(chunkSearchQuery.toLowerCase());
    }
    return true;
  });

  const selectedTopicObj = targetTopics.find((t) => t.id === targetTopicId);

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" /> Content Pipeline & Curriculum
              Alignment
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              Document Chunking & Topic Mapping Studio
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Select source textbook material, inspect parsed chunk passages,
              and map them to syllabus topics or create new concepts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUploadDrawer((prev) => !prev)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-800 text-white rounded-lg text-xs font-semibold hover:bg-teal-900 transition-all shadow-xs"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>
                {showUploadDrawer ? "Close Upload" : "Upload New Material"}
              </span>
            </button>

            <button
              onClick={() => {
                loadCatalogue(filterClass);
                if (selectedDocument) loadChunks(selectedDocument.id);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-all border border-stone-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
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
      {successMessage && (
        <AlertBanner
          type="success"
          title="Success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Upload New Material Drawer / Card (Collapsible) */}
      {showUploadDrawer && (
        <div className="bg-white rounded-xl border-2 border-teal-600/50 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-teal-800" />
              <div>
                <h3 className="font-bold text-sm text-stone-900">
                  Upload New PDF Textbook / Chapter
                </h3>
                <p className="text-[11px] text-stone-500">
                  Extracts text and splits into searchable chunks
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUploadDrawer(false)}
              className="text-stone-400 hover:text-stone-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleUpload} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Source Name
                </label>
                <input
                  type="text"
                  value={uploadSourceName}
                  onChange={(e) => setUploadSourceName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                  placeholder="e.g. NCERT"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Class Level
                </label>
                <select
                  value={uploadClassLevel}
                  onChange={(e) => setUploadClassLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
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
                  value={uploadSubjectName}
                  onChange={(e) => setUploadSubjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Chapter Title (Optional)
                </label>
                <input
                  type="text"
                  value={uploadChapterTitle}
                  onChange={(e) => setUploadChapterTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                  placeholder="e.g. Triangles"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Select PDF File
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0] || null;
                    setFile(selectedFile);
                    if (selectedFile) {
                      const fname = selectedFile.name.toLowerCase();
                      if (
                        fname.includes("science") ||
                        fname.startsWith("jesc") ||
                        fname.startsWith("iesc")
                      ) {
                        setUploadSubjectName("Science");
                      } else if (
                        fname.includes("math") ||
                        fname.startsWith("jemh") ||
                        fname.startsWith("iemh")
                      ) {
                        setUploadSubjectName("Mathematics");
                      }
                      if (
                        fname.startsWith("iesc") ||
                        fname.startsWith("iemh")
                      ) {
                        setUploadClassLevel(9);
                      } else if (
                        fname.startsWith("jesc") ||
                        fname.startsWith("jemh")
                      ) {
                        setUploadClassLevel(10);
                      }
                    }
                  }}
                  className="w-full px-2 py-1.5 text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-stone-200 file:text-stone-800 hover:file:bg-stone-300 bg-stone-50 border border-stone-300 rounded-lg cursor-pointer"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUploadDrawer(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !file}
                className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-lg font-semibold text-xs disabled:opacity-50 transition-all flex items-center gap-2 shadow-xs"
              >
                {isUploading ? (
                  <>
                    <LoadingSpinner size="sm" className="text-white" />
                    <span>Extracting Text & Generating Chunks...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload & Process Document</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MATERIAL SELECTOR BAR & SOURCE STATS                       */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Material Selection Dropdown & Info */}
          <div className="space-y-1 flex-1">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
              1. Select Source Material / Document
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedDocument?.id ?? ""}
                onChange={(e) => {
                  const doc = documents.find(
                    (d) => d.id === Number(e.target.value),
                  );
                  if (doc) setSelectedDocument(doc);
                }}
                className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800 min-w-[280px] max-w-md truncate"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    #{d.id} • Class {d.class_level} {d.subject} - {d.title}
                  </option>
                ))}
              </select>

              {selectedDocument && (
                <div className="flex items-center gap-2">
                  <Badge variant="stone" size="sm">
                    Class {selectedDocument.class_level} •{" "}
                    {selectedDocument.subject}
                  </Badge>
                  <Badge
                    variant={
                      selectedDocument.status === "processed"
                        ? "emerald"
                        : "amber"
                    }
                    size="sm"
                  >
                    {selectedDocument.status} ({chunks.length} chunks)
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Quick Catalogue Class Filter */}
          <div className="flex items-center gap-2 self-start lg:self-center">
            <span className="text-stone-500 text-xs">Filter Material:</span>
            <div className="flex items-center bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs">
              <button
                onClick={() => {
                  setFilterClass(undefined);
                  loadCatalogue(undefined);
                }}
                className={`px-2.5 py-1 rounded font-medium ${
                  filterClass === undefined
                    ? "bg-white shadow-2xs text-stone-900 font-semibold"
                    : "text-stone-600"
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setFilterClass(9);
                  loadCatalogue(9);
                }}
                className={`px-2.5 py-1 rounded font-medium ${
                  filterClass === 9
                    ? "bg-white shadow-2xs text-stone-900 font-semibold"
                    : "text-stone-600"
                }`}
              >
                Class 9
              </button>
              <button
                onClick={() => {
                  setFilterClass(10);
                  loadCatalogue(10);
                }}
                className={`px-2.5 py-1 rounded font-medium ${
                  filterClass === 10
                    ? "bg-white shadow-2xs text-stone-900 font-semibold"
                    : "text-stone-600"
                }`}
              >
                Class 10
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* MAIN MAPPING STUDIO: 2-COLUMN LAYOUT                       */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Column: Target Taxonomy & Topic Creator (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-xs space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-800" />
                <h2 className="font-bold text-xs text-stone-900 uppercase tracking-wide">
                  2. Syllabus Target Topic
                </h2>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Class Selector */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Class
                </label>
                <select
                  value={targetClassLevel}
                  onChange={(e) =>
                    handleTargetClassChange(Number(e.target.value))
                  }
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.class_level}>
                      Class {c.class_level}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Selector */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Subject
                </label>
                <select
                  value={targetSubjectId ?? ""}
                  onChange={(e) =>
                    handleTargetSubjectChange(Number(e.target.value))
                  }
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  {targetSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chapter Selector */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Chapter
                </label>
                <select
                  value={targetChapterId ?? ""}
                  onChange={(e) =>
                    handleTargetChapterChange(Number(e.target.value))
                  }
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  {targetChapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic Selector + Inline Add Topic Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-stone-700 text-[11px]">
                    Topic / Concept
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewTopicModal(true)}
                    className="text-[11px] font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1 transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Add New Topic</span>
                  </button>
                </div>

                <select
                  value={targetTopicId ?? ""}
                  onChange={(e) => setTargetTopicId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                >
                  {targetTopics.length === 0 ? (
                    <option value="">
                      No topics created yet in this chapter
                    </option>
                  ) : (
                    targetTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Mapping Action Box */}
              <div className="pt-3 border-t border-stone-100 space-y-2.5">
                <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200/70 text-[11px] text-stone-600">
                  <span className="font-semibold text-stone-800">
                    Selected Target:
                  </span>{" "}
                  <span className="text-teal-900 font-bold">
                    {selectedTopicObj
                      ? selectedTopicObj.title
                      : "No topic selected"}
                  </span>
                </div>

                <button
                  onClick={handleBulkAssignTopic}
                  disabled={
                    isAssigning ||
                    selectedChunkIds.length === 0 ||
                    !targetTopicId
                  }
                  className="w-full py-2.5 bg-teal-800 text-white rounded-lg text-xs font-semibold hover:bg-teal-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  {isAssigning ? (
                    <LoadingSpinner size="sm" className="text-white" />
                  ) : (
                    <Link className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {selectedChunkIds.length === 0
                      ? "Select Chunks to Assign"
                      : `Map ${selectedChunkIds.length} Chunk(s) to Topic`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Chunks Workspace (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-5 shadow-xs space-y-4">
            {/* Chunks Workspace Controls Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-800" />
                <h3 className="font-bold text-xs text-stone-900 uppercase tracking-wide">
                  Parsed Chunks ({chunks.length})
                </h3>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search chunk text..."
                    value={chunkSearchQuery}
                    onChange={(e) => setChunkSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-teal-800 w-full sm:w-44 text-stone-900"
                  />
                </div>

                <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
                  <button
                    onClick={() => setChunkFilterStatus("all")}
                    className={`px-2 py-1 rounded font-medium ${
                      chunkFilterStatus === "all"
                        ? "bg-white shadow-2xs text-stone-900 font-semibold"
                        : "text-stone-500"
                    }`}
                  >
                    All ({chunks.length})
                  </button>
                  <button
                    onClick={() => setChunkFilterStatus("unmapped")}
                    className={`px-2 py-1 rounded font-medium ${
                      chunkFilterStatus === "unmapped"
                        ? "bg-white shadow-2xs text-amber-800 font-semibold"
                        : "text-stone-500"
                    }`}
                  >
                    Unmapped ({chunks.filter((c) => c.topic_id === null).length}
                    )
                  </button>
                  <button
                    onClick={() => setChunkFilterStatus("mapped")}
                    className={`px-2 py-1 rounded font-medium ${
                      chunkFilterStatus === "mapped"
                        ? "bg-white shadow-2xs text-emerald-800 font-semibold"
                        : "text-stone-500"
                    }`}
                  >
                    Mapped ({chunks.filter((c) => c.topic_id !== null).length})
                  </button>
                </div>
              </div>
            </div>

            {/* Selection Quick Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-stone-50 p-2.5 rounded-xl border border-stone-200/70">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllFiltered}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-300 rounded-lg font-medium text-stone-700 hover:bg-stone-100 shadow-2xs text-xs"
                >
                  {filteredChunks.length > 0 &&
                  filteredChunks.every((c) =>
                    selectedChunkIds.includes(c.id),
                  ) ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-teal-800" />{" "}
                      Deselect Filtered
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 text-stone-400" /> Select
                      Filtered ({filteredChunks.length})
                    </>
                  )}
                </button>

                <button
                  onClick={handleSelectAllUnmapped}
                  className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg font-medium text-amber-800 hover:bg-stone-100 shadow-2xs text-xs"
                >
                  Select All Unmapped
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-stone-500 font-medium">
                  <strong>{selectedChunkIds.length}</strong> of {chunks.length}{" "}
                  selected
                </span>
                {selectedChunkIds.length > 0 && (
                  <button
                    onClick={() => setSelectedChunkIds([])}
                    className="text-[11px] text-rose-600 hover:underline font-semibold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Chunks List Cards */}
            {loadingChunks ? (
              <div className="py-16 text-center">
                <LoadingSpinner label="Loading document chunks..." />
              </div>
            ) : filteredChunks.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-xs bg-stone-50 rounded-xl border border-stone-200">
                No chunks found matching current filter or search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
                {filteredChunks.map((chunk) => {
                  const isSelected = selectedChunkIds.includes(chunk.id);
                  const isMapped = chunk.topic_id !== null;
                  return (
                    <div
                      key={chunk.id}
                      onClick={() => toggleChunkSelect(chunk.id)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? "bg-teal-50/70 border-teal-700 ring-1 ring-teal-700 shadow-2xs"
                          : "bg-white border-stone-200 hover:border-stone-300 hover:shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-stone-100/80 pb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-teal-800 focus:ring-teal-700 cursor-pointer"
                          />
                          <span className="font-mono text-[11px] font-bold text-stone-900">
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

                      <p className="text-stone-700 text-[11px] leading-relaxed line-clamp-4 bg-stone-50/80 p-2.5 rounded-lg border border-stone-100 font-sans">
                        {chunk.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* ADD NEW TOPIC MODAL                                        */}
      {/* ────────────────────────────────────────────────────────── */}
      {showNewTopicModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-teal-800" />
                <h3 className="font-bold text-stone-900 text-sm">
                  Add New Syllabus Topic
                </h3>
              </div>
              <button
                onClick={() => setShowNewTopicModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTopic} className="space-y-4 text-xs">
              <div className="bg-stone-50 rounded-lg p-3 border border-stone-200 text-stone-600 space-y-1 text-[11px]">
                <div>
                  <span className="font-semibold text-stone-700">Class:</span>{" "}
                  Class {targetClassLevel}
                </div>
                <div>
                  <span className="font-semibold text-stone-700">Subject:</span>{" "}
                  {targetSubjects.find((s) => s.id === targetSubjectId)?.name ||
                    "Selected Subject"}
                </div>
                <div>
                  <span className="font-semibold text-stone-700">Chapter:</span>{" "}
                  {targetChapters.find((c) => c.id === targetChapterId)
                    ?.title || "Selected Chapter"}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Topic / Concept Title
                </label>
                <input
                  type="text"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-800"
                  placeholder="e.g. Criteria for Similarity of Triangles"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowNewTopicModal(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTopic || !newTopicTitle.trim()}
                  className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-all flex items-center gap-2 shadow-xs"
                >
                  {isCreatingTopic ? (
                    <LoadingSpinner size="sm" className="text-white" />
                  ) : (
                    <PlusCircle className="w-4 h-4" />
                  )}
                  <span>Create Topic</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
