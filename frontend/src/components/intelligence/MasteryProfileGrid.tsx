import React, { useState, useMemo } from "react";
import { ConceptMasteryCard } from "../../types";
import { MasteryTierBadge, normalizeTier } from "./MasteryTierBadge";
import { Search, Layers } from "lucide-react";

interface MasteryProfileGridProps {
  profile: ConceptMasteryCard[];
  onSelectConcept?: (concept: ConceptMasteryCard) => void;
  className?: string;
}

export const MasteryProfileGrid: React.FC<MasteryProfileGridProps> = ({
  profile,
  onSelectConcept,
  className = "",
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");

  const filteredProfile = useMemo(() => {
    return profile.filter((item) => {
      const matchesSearch = item.label
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (tierFilter === "ALL") return true;
      if (tierFilter === "ASSESSED") return item.assessed;
      if (tierFilter === "UNASSESSED") return !item.assessed;

      const normalized = normalizeTier(item.tier);
      return normalized === tierFilter;
    });
  }, [profile, searchQuery, tierFilter]);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: profile.length,
      ASSESSED: profile.filter((p) => p.assessed).length,
      CRITICAL_GAP: 0,
      EMERGING: 0,
      DEVELOPING: 0,
      PROFICIENT: 0,
      MASTERED: 0,
      UNKNOWN: 0,
    };

    profile.forEach((item) => {
      const t = normalizeTier(item.tier);
      counts[t] = (counts[t] || 0) + 1;
    });

    return counts;
  }, [profile]);

  return (
    <div
      className={`bg-white rounded-xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-4 ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-teal-800 font-semibold text-[11px] uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" /> Concept Mastery
          </div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900 mt-0.5">
            Full Competency Mastery Profile ({profile.length})
          </h2>
          <p className="text-xs text-stone-500">
            Categorized five-tier probabilistic scores mapped to curriculum
            competency nodes.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-teal-800 w-full text-stone-900"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2">
        <button
          onClick={() => setTierFilter("ALL")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            tierFilter === "ALL"
              ? "bg-stone-900 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          All ({tierCounts.ALL})
        </button>
        <button
          onClick={() => setTierFilter("CRITICAL_GAP")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            tierFilter === "CRITICAL_GAP"
              ? "bg-rose-700 text-white"
              : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60"
          }`}
        >
          Critical Gap ({tierCounts.CRITICAL_GAP})
        </button>
        <button
          onClick={() => setTierFilter("EMERGING")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            tierFilter === "EMERGING"
              ? "bg-amber-600 text-white"
              : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
          }`}
        >
          Emerging ({tierCounts.EMERGING})
        </button>
        <button
          onClick={() => setTierFilter("DEVELOPING")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            tierFilter === "DEVELOPING"
              ? "bg-sky-700 text-white"
              : "bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200/60"
          }`}
        >
          Developing ({tierCounts.DEVELOPING})
        </button>
        <button
          onClick={() => setTierFilter("PROFICIENT")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            tierFilter === "PROFICIENT"
              ? "bg-emerald-700 text-white"
              : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
          }`}
        >
          Proficient ({tierCounts.PROFICIENT})
        </button>
        <button
          onClick={() => setTierFilter("MASTERED")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            tierFilter === "MASTERED"
              ? "bg-teal-800 text-white"
              : "bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/60"
          }`}
        >
          Mastered ({tierCounts.MASTERED})
        </button>
        <button
          onClick={() => setTierFilter("UNKNOWN")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            tierFilter === "UNKNOWN"
              ? "bg-stone-700 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200"
          }`}
        >
          Not Assessed ({tierCounts.UNKNOWN})
        </button>
      </div>

      {/* Grid Cards */}
      {filteredProfile.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-xs">
          No concepts match the search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredProfile.map((concept) => {
            const hasScore =
              concept.mastery_score !== null &&
              concept.mastery_score !== undefined;
            const score = hasScore ? concept.mastery_score! : null;

            return (
              <div
                key={concept.id}
                onClick={() => onSelectConcept?.(concept)}
                className={`p-4 rounded-xl border transition-all space-y-3 bg-stone-50/40 hover:bg-white hover:shadow-xs ${
                  onSelectConcept ? "cursor-pointer" : ""
                } border-stone-200/80`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">
                      {concept.label}
                    </h4>
                    <span className="text-[10px] text-stone-400 font-mono block truncate max-w-[200px]">
                      {concept.id}
                    </span>
                  </div>

                  <MasteryTierBadge
                    tier={concept.tier}
                    score={score}
                    size="sm"
                  />
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-500 font-medium">
                      Mastery Index:
                    </span>
                    <span className="font-bold text-stone-900 font-mono">
                      {score !== null ? `${score}%` : "Unknown (No evidence)"}
                    </span>
                  </div>

                  <div className="w-full bg-stone-200/80 h-1.5 rounded-full overflow-hidden">
                    {score !== null && (
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          score >= 85
                            ? "bg-teal-700"
                            : score >= 70
                              ? "bg-emerald-600"
                              : score >= 55
                                ? "bg-sky-600"
                                : score >= 40
                                  ? "bg-amber-600"
                                  : "bg-rose-600"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(0, score))}%`,
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Footer Metrics */}
                <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px] text-stone-500 font-mono">
                  <span>
                    {concept.assessed ? (
                      <span className="text-emerald-700 font-medium">
                        Assessed
                      </span>
                    ) : (
                      <span className="text-stone-400">Not Assessed</span>
                    )}
                  </span>
                  <span>
                    Gate:{" "}
                    <strong
                      className={
                        concept.can_progress
                          ? "text-emerald-700"
                          : "text-stone-700"
                      }
                    >
                      {concept.can_progress
                        ? "Ready (>=70%)"
                        : "Blocked (<70%)"}
                    </strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
