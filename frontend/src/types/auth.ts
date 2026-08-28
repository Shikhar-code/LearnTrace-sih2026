// ==========================================
// LearnTrace Authentication & User Types
// ==========================================

export type UserRole = "student" | "admin";

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  class_level?: number;
  avatar_url?: string;
  token?: string;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  role?: UserRole;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password?: string;
  class_level: number;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  role: UserRole | null;
  loading: boolean;
}

export interface DemoPersona {
  key: string;
  label: string;
  name: string;
  email: string;
  role: UserRole;
  class_level?: number;
  description: string;
  avatarColor: string;
}
