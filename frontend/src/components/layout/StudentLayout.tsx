import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  PlayCircle,
  BarChart3,
  GitFork,
  GraduationCap,
  Layers,
  Shield,
  User,
  Activity,
  Wifi,
  WifiOff,
  Menu,
  X,
} from "lucide-react";
import { systemApi } from "../../services/api";
import { Badge } from "../common/Badge";

export const StudentLayout: React.FC = () => {
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

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    {
      to: "/curriculum",
      label: "Curriculum Explorer",
      icon: BookOpen,
      badge: "NCERT",
    },
    {
      to: "/knowledge-graph",
      label: "Knowledge Graph",
      icon: GitFork,
      badge: "DAG",
    },
    {
      to: "/quiz",
      label: "Quiz Runner",
      icon: PlayCircle,
      badge: "Interactive",
    },
    {
      to: "/mastery",
      label: "Mastery & Analytics",
      icon: BarChart3,
      badge: "Engine",
    },
  ];

  const getPageTitle = () => {
    if (
      location.pathname.startsWith("/knowledge-graph") ||
      location.pathname.startsWith("/graph")
    )
      return "Knowledge Graph Explorer";
    if (location.pathname.startsWith("/quiz")) return "Quiz Runner";
    if (location.pathname.startsWith("/mastery")) return "Mastery Analytics";
    return "Curriculum Explorer";
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
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-stone-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center text-white shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-stone-900 font-sans">
                LearnTrace
              </h1>
              <p className="text-[10px] text-stone-500 font-mono tracking-wide uppercase">
                Student Portal
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
            Learning Modules
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
                    ? "bg-stone-200/80 text-stone-900 font-semibold"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-teal-800" : "text-stone-400"}`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? "bg-stone-300/80 text-stone-800"
                        : "bg-stone-100 text-stone-500"
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
              <Layers className="w-3.5 h-3.5 text-teal-800" />
              <span>Academic Scope</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
              Classes 9 & 10 (Maths & Science) with NCERT source mapping.
            </p>
          </div>

          <Link
            to="/admin/ingest"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-stone-100 hover:bg-stone-200/80 text-stone-700 text-xs font-semibold border border-stone-300/70 transition-all shadow-2xs"
          >
            <Shield className="w-3.5 h-3.5 text-teal-800" />
            <span>Switch to Admin Portal</span>
          </Link>
        </div>
      </div>

      {/* Persistent Fixed Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 bg-[#FBFBFA] border-r border-stone-200 flex-col flex-shrink-0 h-screen sticky top-0 z-30">
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-stone-200 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center text-white shadow-xs">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-stone-900 flex items-center gap-1.5 font-sans">
              LearnTrace
            </h1>
            <p className="text-[10px] text-stone-500 font-mono tracking-wide uppercase">
              Student Portal
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400 font-mono">
            Learning Modules
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
                    ? "bg-stone-200/70 text-stone-900 font-semibold"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-teal-800" : "text-stone-400"}`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? "bg-stone-300/80 text-stone-800"
                        : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer Area: Academic Scope & Switch to Admin View */}
        <div className="p-4 border-t border-stone-200 space-y-3 flex-shrink-0">
          <div className="bg-stone-100/70 rounded-xl p-3 text-xs border border-stone-200/80">
            <div className="flex items-center gap-1.5 text-stone-700 font-medium">
              <Layers className="w-3.5 h-3.5 text-teal-800" />
              <span>Academic Focus</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
              Classes 9 & 10 (Maths & Science) with NCERT source mapping.
            </p>
          </div>

          <Link
            to="/admin/ingest"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-stone-100 hover:bg-stone-200/80 text-stone-700 text-xs font-semibold border border-stone-300/70 transition-all shadow-2xs"
          >
            <Shield className="w-3.5 h-3.5 text-teal-800" />
            <span>Switch to Admin Portal</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Fixed Sticky Top Navbar */}
        <header className="h-16 bg-[#FBFBFA]/95 backdrop-blur border-b border-stone-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hamburger Button on Mobile */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 -ml-1 text-stone-600 hover:bg-stone-100 rounded-lg md:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h2 className="text-sm sm:text-base font-semibold text-stone-900 truncate">
              {getPageTitle()}
            </h2>
            <span className="text-xs text-stone-400 font-mono hidden lg:inline">
              | SIH 2026 Academic Mastery
            </span>
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

            {/* Demo Student User Pill */}
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-stone-200">
              <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-800 flex-shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-medium text-stone-800">
                  Demo Student
                </div>
                <div className="text-[10px] text-stone-400 font-mono">
                  user_id: 1 (Demo)
                </div>
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
