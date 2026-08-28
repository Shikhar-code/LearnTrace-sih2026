import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { DEMO_PERSONAS } from "../../services/authService";
import {
  User,
  LogOut,
  ChevronDown,
  Shield,
  Sparkles,
  Check,
} from "lucide-react";

export const UserMenu: React.FC = () => {
  const { user, logout, loginAsDemo } = useAuth();
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/login");
  };

  const handleSelectPersona = (key: string) => {
    loginAsDemo(key);
    setMenuOpen(false);
    if (key === "admin") {
      navigate("/admin/heatmap");
    } else {
      navigate("/curriculum");
    }
  };

  const isStudent = user.role === "student";

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setMenuOpen((prev) => !prev)}
        className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-stone-200 hover:bg-stone-100/70 p-1.5 rounded-lg transition-all text-left"
        aria-label="User account menu"
      >
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
            isStudent
              ? "bg-teal-50 border border-teal-200/80 text-teal-800"
              : "bg-amber-50 border border-amber-200/80 text-amber-800"
          }`}
        >
          {isStudent ? (
            <User className="w-3.5 h-3.5" />
          ) : (
            <Shield className="w-3.5 h-3.5" />
          )}
        </div>

        <div className="hidden sm:block text-left">
          <div className="text-xs font-semibold text-stone-800 flex items-center gap-1">
            <span className="truncate max-w-[120px]">{user.name}</span>
            <ChevronDown className="w-3 h-3 text-stone-400" />
          </div>
          <div className="text-[10px] text-stone-500 font-mono">
            {isStudent
              ? `Class ${user.class_level || 10} • Student #${user.id}`
              : "Curriculum Admin"}
          </div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-stone-200 z-50 p-2 text-xs divide-y divide-stone-100 animate-in fade-in zoom-in-95 duration-150">
          {/* Active User Card Header */}
          <div className="p-2.5 pb-3">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                  isStudent
                    ? "bg-teal-100 text-teal-800 border border-teal-200"
                    : "bg-amber-100 text-amber-900 border border-amber-200"
                }`}
              >
                {user.role}
              </span>
              <span className="text-[10px] font-mono text-stone-400">
                User ID: {user.id}
              </span>
            </div>
            <div className="font-bold text-stone-900 text-sm">{user.name}</div>
            <div className="text-[11px] text-stone-500 truncate">
              {user.email}
            </div>
          </div>

          {/* Persona Switcher Section */}
          <div className="py-2 space-y-1">
            <div className="px-2 pb-1 text-[10px] font-mono font-semibold uppercase text-stone-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-teal-700" />
              <span>Switch Demo Persona</span>
            </div>
            {DEMO_PERSONAS.map((p) => {
              const isActive =
                p.email.toLowerCase() === user.email.toLowerCase();
              return (
                <button
                  key={p.key}
                  onClick={() => handleSelectPersona(p.key)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                    isActive
                      ? "bg-stone-100 font-semibold text-stone-900"
                      : "hover:bg-stone-50 text-stone-700"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        p.role === "admin"
                          ? "bg-stone-900 text-amber-400"
                          : "bg-teal-700 text-white"
                      }`}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <div className="truncate">
                      <div className="text-xs truncate">{p.label}</div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        {p.role === "admin"
                          ? "Staff Admin"
                          : `Class ${p.class_level}`}
                      </div>
                    </div>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-teal-700" />}
                </button>
              );
            })}
          </div>

          {/* Logout Action */}
          <div className="pt-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-rose-700 hover:bg-rose-50 font-medium transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
