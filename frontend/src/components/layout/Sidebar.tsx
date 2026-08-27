import React from 'react';
import { BookOpen, FileText, PlayCircle, BarChart3, GraduationCap, Layers } from 'lucide-react';

export type NavigationTab = 'curriculum' | 'ingestion' | 'assessment' | 'mastery';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const navItems: { id: NavigationTab; label: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
    {
      id: 'curriculum',
      label: 'Curriculum Explorer',
      icon: BookOpen,
      badge: 'NCERT',
    },
    {
      id: 'ingestion',
      label: 'PDF Ingestion & Chunks',
      icon: FileText,
      badge: 'Admin',
    },
    {
      id: 'assessment',
      label: 'Quiz Runner',
      icon: PlayCircle,
      badge: 'Interactive',
    },
    {
      id: 'mastery',
      label: 'Mastery & Analytics',
      icon: BarChart3,
      badge: 'Engine',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col flex-shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
            LearnTrace
          </h1>
          <p className="text-[10px] text-slate-400 font-mono tracking-wide uppercase">SIH 2026 Platform</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-6 px-3 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
          Core Modules
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Workspace Footer Info */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/60 rounded-lg p-3 text-xs border border-slate-700/50">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Academic Focus</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Classes 9 & 10 (Maths & Science) with NCERT source mapping.
          </p>
        </div>
      </div>
    </aside>
  );
};

