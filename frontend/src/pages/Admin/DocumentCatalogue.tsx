import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { documentsApi, academicApi, getApiErrorMessage } from '../../services/api';
import { SourceDocument, AcademicClass } from '../../types';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { AlertBanner } from '../../components/common/AlertBanner';
import {
  FolderOpen,
  Filter,
  FileText,
  RefreshCw,
  Search,
  ExternalLink,
  BookOpen,
} from 'lucide-react';

export const DocumentCatalogue: React.FC = () => {
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [filterClass, setFilterClass] = useState<number | undefined>(undefined);
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadClasses();
    loadCatalogue();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await academicApi.getClasses();
      setClasses(data);
    } catch (err) {
      console.warn('Could not load classes:', err);
    }
  };

  const loadCatalogue = async (classLevel?: number, subject?: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const docs = await documentsApi.getCatalogue(
        classLevel,
        subject?.trim() || undefined
      );
      setDocuments(docs);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newClass?: number, newSub?: string) => {
    setFilterClass(newClass);
    setFilterSubject(newSub ?? filterSubject);
    loadCatalogue(newClass, newSub ?? filterSubject);
  };

  const filteredDocs = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(query) ||
      doc.subject.toLowerCase().includes(query) ||
      doc.source_name.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Card */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-[11px] uppercase tracking-wider">
              <FolderOpen className="w-3.5 h-3.5" /> Content Repository
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 mt-1 tracking-tight">
              NCERT Source Catalogue
            </h1>
            <p className="text-xs text-stone-600 mt-0.5">
              Browse seeded textbooks, reference material, and ingestion statuses across academic grades.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => loadCatalogue(filterClass, filterSubject)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-all border border-stone-200/60"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Link
              to="/admin/ingest"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow-xs transition-all whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" /> Upload New PDF
            </Link>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <AlertBanner
          type="error"
          title="Failed to load catalogue"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium text-[11px]">
            <Filter className="w-3.5 h-3.5 text-stone-400" /> Filters:
          </div>

          <select
            value={filterClass ?? ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              handleFilterChange(val, filterSubject);
            }}
            className="px-2.5 sm:px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-700 flex-1 sm:flex-none"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.class_level}>
                Class {c.class_level}
              </option>
            ))}
          </select>

          <select
            value={filterSubject}
            onChange={(e) => {
              const val = e.target.value;
              handleFilterChange(filterClass, val);
            }}
            className="px-2.5 sm:px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-700 flex-1 sm:flex-none"
          >
            <option value="">All Subjects</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Science">Science</option>
          </select>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search by title, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-teal-800 w-full text-stone-900"
          />
        </div>
      </div>

      {/* Catalogue Table */}
      <div className="bg-white rounded-xl border border-stone-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-10 sm:p-12 text-center">
            <LoadingSpinner label="Loading document catalogue..." />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-10 sm:p-12 text-center text-stone-400 space-y-2">
            <BookOpen className="w-7 h-7 mx-auto text-stone-300" />
            <p className="text-xs font-medium text-stone-600">No documents found matching criteria</p>
            <p className="text-[11px] text-stone-400">Try changing your filters or upload a new PDF.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse min-w-[580px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-600 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-3.5 sm:px-4">Doc ID</th>
                  <th className="py-3 px-3.5 sm:px-4">Document Title</th>
                  <th className="py-3 px-3.5 sm:px-4">Academic Node</th>
                  <th className="py-3 px-3.5 sm:px-4">Source & Format</th>
                  <th className="py-3 px-3.5 sm:px-4">Language</th>
                  <th className="py-3 px-3.5 sm:px-4">Status</th>
                  <th className="py-3 px-3.5 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-3 px-3.5 sm:px-4 font-mono text-stone-500 font-semibold">
                      #{doc.id}
                    </td>
                    <td className="py-3 px-3.5 sm:px-4 font-medium text-stone-900 max-w-xs">
                      <div className="truncate" title={doc.title}>
                        {doc.title}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 sm:px-4 whitespace-nowrap">
                      <Badge variant="stone" size="sm">
                        Class {doc.class_level} • {doc.subject}
                      </Badge>
                    </td>
                    <td className="py-3 px-3.5 sm:px-4 text-stone-600 whitespace-nowrap">
                      <span className="font-semibold text-stone-800">{doc.source_name}</span> ({doc.file_type.toUpperCase()})
                    </td>
                    <td className="py-3 px-3.5 sm:px-4 text-stone-600">
                      {doc.language}
                    </td>
                    <td className="py-3 px-3.5 sm:px-4">
                      <Badge
                        variant={doc.status === 'processed' ? 'emerald' : 'amber'}
                        size="sm"
                      >
                        {doc.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3.5 sm:px-4 text-right whitespace-nowrap">
                      <Link
                        to="/admin/ingest"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md font-medium text-xs transition-all border border-stone-200/80"
                      >
                        <span>Manage</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
