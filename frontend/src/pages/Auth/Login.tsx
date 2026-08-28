import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { DEMO_PERSONAS } from "../../services/authService";
import { UserRole } from "../../types/auth";
import {
  GraduationCap,
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  AlertCircle,
} from "lucide-react";

export const Login: React.FC = () => {
  const { login, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Field-specific validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  // Determine redirection target based on role
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleRedirect = (role: UserRole) => {
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    if (role === "admin") {
      navigate("/admin/heatmap", { replace: true });
    } else {
      navigate("/curriculum", { replace: true });
    }
  };

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      errors.email = "Email address is required.";
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const loggedUser = await login({
        email: email.trim().toLowerCase(),
        password,
      });
      handleRedirect(loggedUser.role);
    } catch (err) {
      setError("Unable to sign in. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = (personaKey: string) => {
    const loggedUser = loginAsDemo(personaKey);
    handleRedirect(loggedUser.role);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Header */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-800 text-white shadow-sm mb-3">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 font-sans">
          LearnTrace
        </h1>
        <p className="text-xs text-stone-500 font-mono uppercase tracking-wider mt-0.5">
          AI Pedagogical Intelligence Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-sm border border-stone-200/90 rounded-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-stone-900">
              Sign In to Your Account
            </h2>
            <p className="text-xs text-stone-500">
              Enter your credentials to access your dashboard.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Standard Credentials Form */}
          <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  placeholder="student@school.edu or admin@learntrace.edu"
                  className={`block w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-teal-700 focus:border-teal-700 bg-stone-50/50 ${
                    fieldErrors.email
                      ? "border-rose-300 ring-1 ring-rose-300"
                      : "border-stone-300"
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="••••••••"
                  className={`block w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-teal-700 focus:border-teal-700 bg-stone-50/50 ${
                    fieldErrors.password
                      ? "border-rose-300 ring-1 ring-rose-300"
                      : "border-stone-300"
                  }`}
                />
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{fieldErrors.password}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <span>{loading ? "Signing in..." : "Sign In"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick SIH Demo Personas Switcher */}
          <div className="pt-4 border-t border-stone-100 space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-stone-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-teal-800" />
                <span>SIH 2026 Demo One-Click Sign In:</span>
              </span>
              <span className="text-[10px] text-stone-400 font-mono">1-Click</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_PERSONAS.map((p) => {
                const isAdmin = p.role === "admin";
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleQuickDemoLogin(p.key)}
                    className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 hover:border-teal-600/70 text-left transition-all group shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-stone-900 text-xs truncate">
                        {p.label}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                          isAdmin
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-teal-100 text-teal-800 border border-teal-200"
                        }`}
                      >
                        {isAdmin ? "Admin" : `Class ${p.class_level}`}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-500 line-clamp-1 leading-tight">
                      {p.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Registration Footer */}
          <div className="pt-2 text-center text-xs text-stone-600 border-t border-stone-100">
            New learner?{" "}
            <Link
              to="/register"
              className="font-bold text-teal-800 hover:underline"
            >
              Create your student profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
