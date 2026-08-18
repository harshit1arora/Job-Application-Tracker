import React, { createContext, useContext, useEffect, useState } from "react";
import { signInWithGooglePopup, signOutFirebase } from "./firebase";

export interface User {
  id: string;
  name: string;
  email: string;
  targetRole?: string;
  avatar?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: {
    name: string;
    email: string;
    password: string;
    targetRole?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  demoLogin: () => void;
  googleLogin: () => Promise<{ success: boolean; error?: string }>;
}

const STORAGE_USERS_KEY = "jobpilot_users";
const STORAGE_SESSION_KEY = "jobpilot_session_user";

const DEFAULT_DEMO_USER: User = {
  id: "usr_demo_01",
  name: "Alex Carter",
  email: "demo@jobpilot.ai",
  targetRole: "Full Stack Engineer",
  createdAt: new Date().toISOString(),
};

const DEFAULT_DEMO_PASSWORD = "password123";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize stored users and session
  useEffect(() => {
    try {
      // Initialize seed demo user if not present
      const storedUsersRaw = localStorage.getItem(STORAGE_USERS_KEY);
      let storedUsers: Array<User & { passwordHash: string }> = storedUsersRaw
        ? JSON.parse(storedUsersRaw)
        : [];

      if (!storedUsers.some((u) => u.email.toLowerCase() === DEFAULT_DEMO_USER.email.toLowerCase())) {
        storedUsers.push({
          ...DEFAULT_DEMO_USER,
          passwordHash: DEFAULT_DEMO_PASSWORD,
        });
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(storedUsers));
      }

      // Check current session
      const storedSession = localStorage.getItem(STORAGE_SESSION_KEY);
      if (storedSession) {
        setUser(JSON.parse(storedSession));
      }
    } catch (e) {
      console.error("Failed to parse auth storage:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simulate brief network latency for realistic feel
    await new Promise((res) => setTimeout(res, 400));

    const storedUsersRaw = localStorage.getItem(STORAGE_USERS_KEY);
    const storedUsers: Array<User & { passwordHash: string }> = storedUsersRaw
      ? JSON.parse(storedUsersRaw)
      : [];

    const found = storedUsers.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (!found) {
      return { success: false, error: "No account found with this email address." };
    }

    if (found.passwordHash !== password) {
      return { success: false, error: "Incorrect password. Please try again." };
    }

    const sessionUser: User = {
      id: found.id,
      name: found.name,
      email: found.email,
      targetRole: found.targetRole,
      avatar: found.avatar,
      createdAt: found.createdAt,
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
    return { success: true };
  };

  const signup = async (data: {
    name: string;
    email: string;
    password: string;
    targetRole?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    await new Promise((res) => setTimeout(res, 500));

    const storedUsersRaw = localStorage.getItem(STORAGE_USERS_KEY);
    const storedUsers: Array<User & { passwordHash: string }> = storedUsersRaw
      ? JSON.parse(storedUsersRaw)
      : [];

    const normalizedEmail = data.email.trim().toLowerCase();

    if (storedUsers.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return { success: false, error: "An account with this email already exists." };
    }

    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: data.name.trim(),
      email: normalizedEmail,
      targetRole: data.targetRole?.trim() || "Software Engineer",
      createdAt: new Date().toISOString(),
    };

    storedUsers.push({
      ...newUser,
      passwordHash: data.password,
    });

    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(storedUsers));
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(newUser));
    setUser(newUser);

    return { success: true };
  };

  const googleLogin = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await signInWithGooglePopup();

      if (!result.success || !result.user) {
        // If popup was closed by user
        if (result.code === "auth/popup-closed-by-user") {
          return { success: false, error: "Google Sign-In was cancelled." };
        }
        return { success: false, error: result.error || "Google Sign-In failed." };
      }

      const googleUser: User = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        targetRole: "Software Engineer",
        avatar: result.user.avatar,
        createdAt: result.user.createdAt,
      };

      const storedUsersRaw = localStorage.getItem(STORAGE_USERS_KEY);
      const storedUsers: Array<User & { passwordHash: string }> = storedUsersRaw
        ? JSON.parse(storedUsersRaw)
        : [];

      if (!storedUsers.some((u) => u.email.toLowerCase() === googleUser.email.toLowerCase())) {
        storedUsers.push({
          ...googleUser,
          passwordHash: "google_firebase_oauth",
        });
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(storedUsers));
      }

      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(googleUser));
      setUser(googleUser);
      return { success: true };
    } catch (err: any) {
      console.error("Google Auth error:", err);
      return { success: false, error: err.message || "Failed to authenticate with Google." };
    }
  };

  const logout = () => {
    signOutFirebase();
    localStorage.removeItem(STORAGE_SESSION_KEY);
    setUser(null);
  };

  const demoLogin = () => {
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(DEFAULT_DEMO_USER));
    setUser(DEFAULT_DEMO_USER);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        demoLogin,
        googleLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
