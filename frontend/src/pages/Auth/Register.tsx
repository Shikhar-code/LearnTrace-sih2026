import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  GraduationCap,
  ArrowRight,
  User,
  Mail,
  Lock,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [classLevel, setClassLevel] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Field-specific validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = (): boolean => {
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = "Full name is required.";
    } else if (trimmedName.length < 2) {
      errors.name = "Full name must be at least 2 characters.";
    }

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      errors.email = "Email address is required.";
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address (e.g., student@school.edu).";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters long.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (confirmPassword !== password) {
      errors.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        class_level: classLevel,
      });
      navigate("/curriculum", { replace: true });
    } catch (err) {
      setError("Failed to create profile. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;
  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-800 text-white shadow-sm mb-3">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 font-sans">
          Join LearnTrace
        </h1>
        <p className="text-xs text-stone-500 font-mono uppercase tracking-wider mt-0.5">
          Student Profile Registration
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-sm border border-stone-200/90 rounded-2xl space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) {
                      setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder="e.g. Priya Sharma"
                  className={`block w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-teal-700 focus:border-teal-700 bg-stone-50/50 ${
                    fieldErrors.name
                      ? "border-rose-300 ring-1 ring-rose-300"
                      : "border-stone-300"
                  }`}
                />
              </div>
              {fieldErrors.name && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{fieldErrors.name}</span>
                </p>
              )}
            </div>

            {/* Email Address */}
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
                  placeholder="student@school.edu"
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

            {/* Password */}
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
                  placeholder="At least 6 characters"
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

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  placeholder="Re-enter your password"
                  className={`block w-full pl-9 pr-8 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-teal-700 focus:border-teal-700 bg-stone-50/50 ${
                    fieldErrors.confirmPassword || passwordsMismatch
                      ? "border-rose-300 ring-1 ring-rose-300"
                      : passwordsMatch
                      ? "border-emerald-300 ring-1 ring-emerald-300"
                      : "border-stone-300"
                  }`}
                />
                {passwordsMatch && (
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
                {passwordsMismatch && (
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-rose-500">
                    <XCircle className="w-4 h-4" />
                  </div>
                )}
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{fieldErrors.confirmPassword}</span>
                </p>
              )}
            </div>

            {/* Academic Class Selection */}
            <div>
              <label
                htmlFor="classLevel"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                NCERT Academic Class <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClassLevel(10)}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    classLevel === 10
                      ? "bg-teal-50 border-teal-600 text-teal-900 shadow-2xs ring-1 ring-teal-600"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Class 10</span>
                </button>

                <button
                  type="button"
                  onClick={() => setClassLevel(9)}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    classLevel === 9
                      ? "bg-teal-50 border-teal-600 text-teal-900 shadow-2xs ring-1 ring-teal-600"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Class 9</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs transition-all mt-2"
            >
              <span>
                {loading ? "Creating Profile..." : "Complete Registration"}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-stone-600 border-t border-stone-100">
            Already have a profile?{" "}
            <Link
              to="/login"
              className="font-bold text-teal-800 hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
