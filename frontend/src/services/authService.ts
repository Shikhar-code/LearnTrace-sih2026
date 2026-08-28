import {
  UserProfile,
  UserRole,
  LoginCredentials,
  RegisterPayload,
  DemoPersona,
} from "../types/auth";
import { apiClient } from "./api";

const AUTH_STORAGE_KEY = "learntrace_auth_user";

// Pre-seeded SIH 2026 Demo Personas matching backend database seed records
export const DEMO_PERSONAS: DemoPersona[] = [
  {
    key: "asha",
    label: "Asha Demo",
    name: "Asha Demo",
    email: "learntrace.demo.asha@example.invalid",
    role: "student",
    class_level: 10,
    description: "Focus: Root-cause remediation needed in Trigonometry",
    avatarColor: "bg-teal-700 text-white",
  },
  {
    key: "ravi",
    label: "Ravi Demo",
    name: "Ravi Demo",
    email: "learntrace.demo.ravi@example.invalid",
    role: "student",
    class_level: 10,
    description: "Focus: Developing foundation, progressing through Level 1",
    avatarColor: "bg-amber-700 text-white",
  },
  {
    key: "meera",
    label: "Meera Demo",
    name: "Meera Demo",
    email: "learntrace.demo.meera@example.invalid",
    role: "student",
    class_level: 10,
    description: "Focus: Advanced mastery across Mathematics concepts",
    avatarColor: "bg-indigo-700 text-white",
  },
  {
    key: "admin",
    label: "Curriculum Admin",
    name: "Curriculum Administrator",
    email: "admin@learntrace.edu",
    role: "admin",
    description: "Staff: Full access to PDF Ingestion & Cohort Heatmap",
    avatarColor: "bg-stone-900 text-amber-400",
  },
];

export const authService = {
  /**
   * Retrieves the currently persisted user from localStorage, or null if unauthenticated.
   */
  getStoredUser: (): UserProfile | null => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as UserProfile;
      }
    } catch (err) {
      console.warn("Failed to parse stored auth user:", err);
    }
    return null;
  },

  /**
   * Persists the user profile into localStorage.
   */
  storeUser: (user: UserProfile): void => {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch (err) {
      console.error("Failed to persist auth user:", err);
    }
  },

  /**
   * Clears auth data from storage upon logout.
   */
  clearUser: (): void => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear auth user:", err);
    }
  },

  /**
   * Login with email and password or demo identity.
   * If the backend has a live /auth/login endpoint, it calls it; otherwise matches seeded profiles.
   */
  login: async (credentials: LoginCredentials): Promise<UserProfile> => {
    // 1. Check if matching a demo persona
    const matchingPersona = DEMO_PERSONAS.find(
      (p) => p.email.toLowerCase() === credentials.email.toLowerCase(),
    );

    if (matchingPersona) {
      const personaId =
        matchingPersona.key === "asha"
          ? 1
          : matchingPersona.key === "ravi"
            ? 2
            : matchingPersona.key === "meera"
              ? 3
              : 99;

      const profile: UserProfile = {
        id: personaId,
        name: matchingPersona.name,
        email: matchingPersona.email,
        role: matchingPersona.role,
        class_level: matchingPersona.class_level,
        token: `demo-jwt-token-${matchingPersona.key}`,
      };
      authService.storeUser(profile);
      return profile;
    }

    // 2. Fallback to API if backend auth endpoint exists
    try {
      const response = await apiClient.post<{
        user: UserProfile;
        access_token?: string;
      }>("/auth/login", credentials);
      const profile: UserProfile = {
        ...response.data.user,
        token: response.data.access_token,
      };
      authService.storeUser(profile);
      return profile;
    } catch (apiErr) {
      // 3. If standard test user: determine role dynamically from email
      const requestedRole: UserRole =
        credentials.role ||
        (credentials.email.toLowerCase().includes("admin")
          ? "admin"
          : "student");
      const profile: UserProfile = {
        id: requestedRole === "admin" ? 99 : 1,
        name:
          credentials.email.split("@")[0] ||
          (requestedRole === "admin" ? "Admin" : "Student"),
        email: credentials.email,
        role: requestedRole,
        class_level: requestedRole === "student" ? 10 : undefined,
        token: `session-${Date.now()}`,
      };
      authService.storeUser(profile);
      return profile;
    }
  },

  /**
   * Quick-login helper for selecting a specific demo persona.
   */
  loginAsDemoPersona: (personaKey: string): UserProfile => {
    const persona =
      DEMO_PERSONAS.find((p) => p.key === personaKey) || DEMO_PERSONAS[0];

    const personaId =
      persona.key === "asha"
        ? 1
        : persona.key === "ravi"
          ? 2
          : persona.key === "meera"
            ? 3
            : 99;

    const profile: UserProfile = {
      id: personaId,
      name: persona.name,
      email: persona.email,
      role: persona.role,
      class_level: persona.class_level,
      token: `demo-jwt-token-${persona.key}`,
    };
    authService.storeUser(profile);
    return profile;
  },

  /**
   * Register a new student account.
   */
  register: async (payload: RegisterPayload): Promise<UserProfile> => {
    try {
      const response = await apiClient.post<{
        user: UserProfile;
        access_token?: string;
      }>("/auth/register", payload);
      const profile: UserProfile = {
        ...response.data.user,
        token: response.data.access_token,
      };
      authService.storeUser(profile);
      return profile;
    } catch (err) {
      // Client-side registered session
      const profile: UserProfile = {
        id: 1,
        name: payload.name,
        email: payload.email,
        role: "student",
        class_level: payload.class_level,
        token: `session-${Date.now()}`,
      };
      authService.storeUser(profile);
      return profile;
    }
  },

  /**
   * Logout the current user.
   */
  logout: (): void => {
    authService.clearUser();
  },
};
