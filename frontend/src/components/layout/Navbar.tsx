import React, { useEffect, useState } from 'react';
import { systemApi } from '../../services/api';
import { Badge } from '../common/Badge';
import { User, Activity, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  activeTabTitle: string;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTabTitle }) => {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const verifyBackend = async () => {
    const isUp = await systemApi.checkHealth();
    setBackendOnline(isUp);
  };

  useEffect(() => {
    verifyBackend();
    const interval = setInterval(verifyBackend, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-800">{activeTabTitle}</h2>
        <span className="text-xs text-slate-400 font-mono hidden sm:inline">| SIH 2026 Academic Mastery</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Backend Connectivity Status */}
        <div className="flex items-center gap-2">
          {backendOnline === null ? (
            <Badge variant="slate" size="sm">
              <Activity className="w-3 h-3 animate-pulse" /> Connecting...
            </Badge>
          ) : backendOnline ? (
            <Badge variant="emerald" size="sm">
              <Wifi className="w-3 h-3" /> API Connected (8000)
            </Badge>
          ) : (
            <Badge variant="rose" size="sm">
              <WifiOff className="w-3 h-3" /> API Offline
            </Badge>
          )}
        </div>

        {/* Demo Student User Pill */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-800">Demo Student</div>
            <div className="text-[10px] text-slate-500 font-mono">user_id: 1 (Bypassed)</div>
          </div>
        </div>
      </div>
    </header>
  );
};

