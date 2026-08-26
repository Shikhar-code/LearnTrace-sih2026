import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  FileText,
  FolderOpen,
  ArrowLeft,
  ShieldCheck,
  Activity,
  Wifi,
  WifiOff,
  Database,
  Menu,
  X,
} from 'lucide-react';
import { systemApi } from '../../services/api';
import { Badge } from '../common/Badge';

export const AdminLayout: React.FC = () => {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const location = useLocation();

  const verifyBackend = async () => {
    const isUp = await systemApi.checkHealth();
    setBackendOnline(isUp);
  };

  useEffect(() => {
    verifyBackend();
    const interval = setInterval(verifyBackend, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile menu on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    {
      to: '/admin/ingest',
      label: 'PDF Ingestion & Chunks',
      icon: FileText,
      badge: 'Mapper',
    },
    {
      to: '/admin/catalogue',
      label: 'Document Catalogue',
      icon: FolderOpen,
      badge: 'NCERT',
    },
  ];

  const getPageTitle = () => {
    if (location.pathname.startsWith('/admin/catalogue')) return 'Document Catalogue';
    return 'PDF Ingestion & Mapper';
  };

  return (
    <div className="flex h-screen bg-[#F7F7F5] overflow-hidden">
      {/* Mobile Slide-Over Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-[#FBFBFA] z-50 shadow-2xl flex flex-col md:hidden transform transition-transform duration-300 ease-in-out border-r border-stone-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-stone-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-stone-900 font-sans">
                LearnTrace
              </h1>
              <p className="text-[10px] text-amber-700 font-mono tracking-wide uppercase font-semibold">
                Admin Portal
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Navigation Links */}
        <div className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400 font-mono">
            Ingestion & Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-stone-200/80 text-stone-900 font-semibold'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${isActive ? 'text-stone-900' : 'text-stone-400'}`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? 'bg-stone-300/80 text-stone-800'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-stone-200 space-y-3 flex-shrink-0">
          <div className="bg-stone-100/70 rounded-xl p-3 text-xs border border-stone-200/80">
            <div className="flex items-center gap-1.5 text-stone-700 font-medium">
              <Database className="w-3.5 h-3.5 text-stone-600" />
              <span>Admin Mode</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
              Upload NCERT chapters, manage extracted chunks, and configure syllabus topics.
            </p>
          </div>

          <Link
            to="/curriculum"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium shadow-xs transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Student Portal</span>
          </Link>
        </div>
      </div>

      {/* Persistent Fixed Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 bg-[#FBFBFA] border-r border-stone-200 flex-col flex-shrink-0 h-screen sticky top-0 z-30">
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-stone-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-stone-900 flex items-center gap-1.5 font-sans">
                LearnTrace
              </h1>
              <p className="text-[10px] text-amber-700 font-mono tracking-wide uppercase font-semibold">
                Admin Portal
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400 font-mono">
            Ingestion & Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-stone-200/70 text-stone-900 font-semibold'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${isActive ? 'text-stone-900' : 'text-stone-400'}`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? 'bg-stone-300/80 text-stone-800'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer Link: Back to Student Portal */}
        <div className="p-4 border-t border-stone-200 space-y-3 flex-shrink-0">
          <div className="bg-stone-100/70 rounded-xl p-3 text-xs border border-stone-200/80">
            <div className="flex items-center gap-1.5 text-stone-700 font-medium">
              <Database className="w-3.5 h-3.5 text-stone-600" />
              <span>Admin Mode</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
              Upload NCERT chapters, manage extracted chunks, and configure syllabus topics.
            </p>
          </div>

          <Link
            to="/curriculum"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium shadow-xs transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Student Portal</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Fixed Sticky Admin Navbar */}
        <header className="h-16 bg-[#FBFBFA]/95 backdrop-blur border-b border-stone-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hamburger button on mobile */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 -ml-1 text-stone-600 hover:bg-stone-100 rounded-lg md:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Badge variant="amber" size="sm" className="hidden sm:inline-flex">
              Admin Area
            </Badge>
            <h2 className="text-sm sm:text-base font-semibold text-stone-900 truncate">{getPageTitle()}</h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Backend Connectivity Status */}
            <div className="flex items-center gap-1 sm:gap-2">
              {backendOnline === null ? (
                <Badge variant="stone" size="sm">
                  <Activity className="w-3 h-3 animate-pulse text-stone-400" />
                  <span className="hidden sm:inline">Connecting...</span>
                </Badge>
              ) : backendOnline ? (
                <Badge variant="emerald" size="sm">
                  <Wifi className="w-3 h-3" />
                  <span className="hidden sm:inline">API Connected</span>
                </Badge>
              ) : (
                <Badge variant="rose" size="sm">
                  <WifiOff className="w-3 h-3" />
                  <span className="hidden sm:inline">API Offline</span>
                </Badge>
              )}
            </div>

            {/* Admin User Badge */}
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-stone-200">
              <div className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 flex-shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-medium text-stone-800">Curriculum Admin</div>
                <div className="text-[10px] text-stone-400 font-mono">Staff</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
