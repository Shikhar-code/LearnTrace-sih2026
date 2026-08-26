import React from 'react';
import { Sidebar, NavigationTab } from './Sidebar';
import { Navbar } from './Navbar';

interface AppLayoutProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  children: React.ReactNode;
}

const tabTitles: Record<NavigationTab, string> = {
  curriculum: 'Curriculum Explorer & Hierarchy',
  ingestion: 'NCERT Ingestion & Chunk Mapping',
  assessment: 'Student Quiz Runner',
  mastery: 'Mastery Engine & Performance Analytics',
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  onSelectTab,
  children,
}) => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} onSelectTab={onSelectTab} />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar activeTabTitle={tabTitles[activeTab]} />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

