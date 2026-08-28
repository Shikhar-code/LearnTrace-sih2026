import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  UserProfile,
  UserRole,
  LoginCredentials,
  RegisterPayload,
} from "../types/auth";
import { authService } from "../services/authService";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  role: UserRole | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<UserProfile>;
  loginAsDemo: (personaKey: string) => UserProfile;
  register: (payload: RegisterPayload) => Promise<UserProfile>;
  logout: () => void;
  switchRole: (newRole: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserProfile | null>(() =>
    authService.getStoredUser(),
  );
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initial check on mount
    const stored = authService.getStoredUser();
    if (stored) {
      setUser(stored);
    }
    setLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials): Promise<UserProfile> => {
    setLoading(true);
    try {
      const loggedUser = await authService.login(credentials);
      setUser(loggedUser);
      return loggedUser;
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemo = (personaKey: string): UserProfile => {
    const personaUser = authService.loginAsDemoPersona(personaKey);
    setUser(personaUser);
    return personaUser;
  };

  const register = async (payload: RegisterPayload): Promise<UserProfile> => {
    setLoading(true);
    try {
      const newUser = await authService.register(payload);
      setUser(newUser);
      return newUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const switchRole = (newRole: UserRole) => {
    if (newRole === "admin") {
      loginAsDemo("admin");
    } else {
      loginAsDemo("asha");
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    role: user?.role || null,
    loading,
    login,
    loginAsDemo,
    register,
    logout,
    switchRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
