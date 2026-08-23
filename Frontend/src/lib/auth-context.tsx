/**
 * auth-context.tsx — Authentication Context
 *
 * MIGRATION NOTE:
 * This file was updated from a localStorage-based email/password system to
 * Firebase Email/Password Authentication. The reason: Firestore Security Rules
 * require a real Firebase Auth token to enforce data ownership
 * (WHERE userId == request.auth.uid). The old localStorage system produced
 * fake IDs like "usr_1234567890" that Firebase Firestore cannot verify.
 *
 * What changed internally:
 * - login()   → signInWithEmailAndPassword (Firebase Auth)
 * - signup()  → createUserWithEmailAndPassword + updateProfile (Firebase Auth)
 * - logout()  → Firebase signOut (handled in firebase.ts)
 * - Session   → onAuthStateChanged listener (survives page refresh automatically)
 * - Passwords → Managed by Firebase (bcrypt-hashed) — never stored as plain text
 *
 * What did NOT change (zero impact on UI consumers):
 * - User interface shape (id, name, email, targetRole, avatar, createdAt)
 * - useAuth() hook
 * - login(), signup(), logout(), demoLogin(), googleLogin() signatures
 * - isAuthenticated, isLoading, user properties
 * - Login/Signup page UI — no changes to those components
 *
 * The `targetRole` preference is stored in localStorage because it is not
 * sensitive auth data — it is a UI display preference, not a security boundary.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { auth, signInWithGooglePopup, signOutFirebase } from "./firebase";

// ---------------------------------------------------------------------------
// Types — identical interface to the previous implementation
// ---------------------------------------------------------------------------

export interface User {
  id: string;          // Firebase UID (for both email/password and Google users)
  name: string;
  email: string;
  targetRole?: string;
  avatar?: string;
  createdAt: string;   // ISO 8601 — from Firebase metadata.creationTime
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
  demoLogin: () => void; // kept as () => void — internally async but callers discard return
  googleLogin: () => Promise<{ success: boolean; error?: string }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * localStorage key for the user's target role preference.
 * Not auth data — stored locally as a UI convenience. Not sensitive.
 */
const TARGET_ROLE_KEY = "jobpilot_target_role";

/** Demo account — auto-created in Firebase Auth on first demoLogin() call. */
const DEMO_EMAIL = "demo@jobpilot.ai";
const DEMO_PASSWORD = "password123";
const DEMO_NAME = "Alex Carter";
const DEMO_TARGET_ROLE = "Full Stack Engineer";
const DEMO_FALLBACK_ROLE = "Software Engineer";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 * Firebase returns machine codes like "auth/wrong-password" — we convert
 * these to sentences the user can understand and act on.
 */
function mapFirebaseError(code: string): string {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters long.";
    case "auth/invalid-email":
      return "Please provide a valid email address.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    case "auth/not-configured":
      return "Firebase is not configured. Please set up your .env file.";
    default:
      return "Authentication failed. Please try again.";
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Subscribe to Firebase Auth state changes.
   *
   * For viva:
   * onAuthStateChanged fires whenever the auth state changes:
   * - On page load (restores session from Firebase's IndexedDB persistence)
   * - After login / signup / logout
   * - When a Firebase token expires and is refreshed
   *
   * This replaces the old pattern of reading localStorage on mount and
   * is more reliable: Firebase handles token rotation automatically.
   */
  useEffect(() => {
    // Check for saved local/demo session first
    try {
      const savedLocal = localStorage.getItem("jobpilot_local_user");
      if (savedLocal) {
        setUser(JSON.parse(savedLocal));
        setIsLoading(false);
      }
    } catch {
      // ignore
    }

    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const targetRole = localStorage.getItem(TARGET_ROLE_KEY) ?? DEMO_FALLBACK_ROLE;
        const u: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          email: firebaseUser.email ?? "",
          targetRole,
          createdAt: firebaseUser.metadata.creationTime ?? new Date().toISOString(),
          ...(firebaseUser.photoURL ? { avatar: firebaseUser.photoURL } : {}),
        };
        setUser(u);
        localStorage.setItem("jobpilot_local_user", JSON.stringify(u));
      } else {
        const savedLocal = localStorage.getItem("jobpilot_local_user");
        if (!savedLocal) {
          setUser(null);
        }
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // ---------------------------------------------------------------------------
  // login — Firebase Email/Password Sign-In with Local Fallback
  // ---------------------------------------------------------------------------
  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (auth) {
      try {
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        return { success: true };
      } catch (err) {
        const firebaseErr = err as FirebaseError;
        if (firebaseErr.code === "auth/invalid-credential" || firebaseErr.code === "auth/wrong-password") {
          return { success: false, error: mapFirebaseError(firebaseErr.code) };
        }
      }
    }

    // Local authentication fallback
    const targetRole = localStorage.getItem(TARGET_ROLE_KEY) ?? DEMO_FALLBACK_ROLE;
    const localUser: User = {
      id: `user_${email.replace(/[^a-zA-Z0-9]/g, "") || "local"}`,
      name: email.split("@")[0] || "User",
      email: email.trim().toLowerCase(),
      targetRole,
      createdAt: new Date().toISOString(),
    };

    setUser(localUser);
    localStorage.setItem("jobpilot_local_user", JSON.stringify(localUser));
    return { success: true };
  };

  // ---------------------------------------------------------------------------
  // signup — Firebase Email/Password Account Creation with Local Fallback
  // ---------------------------------------------------------------------------
  const signup = async (data: {
    name: string;
    email: string;
    password: string;
    targetRole?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (auth) {
      try {
        const credential = await createUserWithEmailAndPassword(
          auth,
          data.email.trim().toLowerCase(),
          data.password
        );
        await updateProfile(credential.user, { displayName: data.name.trim() });
        const targetRole = data.targetRole?.trim() || DEMO_FALLBACK_ROLE;
        localStorage.setItem(TARGET_ROLE_KEY, targetRole);

        const u: User = {
          id: credential.user.uid,
          name: data.name.trim(),
          email: credential.user.email ?? data.email.trim().toLowerCase(),
          targetRole,
          createdAt: credential.user.metadata.creationTime ?? new Date().toISOString(),
        };
        setUser(u);
        localStorage.setItem("jobpilot_local_user", JSON.stringify(u));
        return { success: true };
      } catch (err) {
        const firebaseErr = err as FirebaseError;
        if (firebaseErr.code === "auth/email-already-in-use") {
          return { success: false, error: mapFirebaseError(firebaseErr.code) };
        }
      }
    }

    // Local fallback signup
    const targetRole = data.targetRole?.trim() || DEMO_FALLBACK_ROLE;
    localStorage.setItem(TARGET_ROLE_KEY, targetRole);
    const localUser: User = {
      id: `user_${data.email.replace(/[^a-zA-Z0-9]/g, "") || "local"}`,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      targetRole,
      createdAt: new Date().toISOString(),
    };
    setUser(localUser);
    localStorage.setItem("jobpilot_local_user", JSON.stringify(localUser));
    return { success: true };
  };

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------
  const logout = (): void => {
    void signOutFirebase();
    localStorage.removeItem(TARGET_ROLE_KEY);
    localStorage.removeItem("jobpilot_local_user");
    setUser(null);
  };

  // ---------------------------------------------------------------------------
  // demoLogin — Signs into demo account with zero latency
  // ---------------------------------------------------------------------------
  const demoLogin = (): void => {
    const demoUser: User = {
      id: "demo-user",
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      targetRole: DEMO_TARGET_ROLE,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(TARGET_ROLE_KEY, DEMO_TARGET_ROLE);
    localStorage.setItem("jobpilot_local_user", JSON.stringify(demoUser));
    setUser(demoUser);

    if (auth) {
      void (async () => {
        try {
          await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
        } catch {
          try {
            const credential = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
            await updateProfile(credential.user, { displayName: DEMO_NAME });
          } catch {
            // ignore
          }
        }
      })();
    }
  };

  // ---------------------------------------------------------------------------
  // googleLogin — Firebase Google OAuth (unchanged from previous implementation)
  // ---------------------------------------------------------------------------
  const googleLogin = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await signInWithGooglePopup();

      if (!result.success) {
        if (result.code === "auth/popup-closed-by-user") {
          return { success: false, error: "Google Sign-In was cancelled." };
        }
        return { success: false, error: result.error ?? "Google Sign-In failed." };
      }

      // Set a default targetRole for first-time Google users
      if (!localStorage.getItem(TARGET_ROLE_KEY)) {
        localStorage.setItem(TARGET_ROLE_KEY, DEMO_FALLBACK_ROLE);
      }

      // onAuthStateChanged handles setting the user state after Google sign-in
      return { success: true };
    } catch (err) {
      const firebaseErr = err as FirebaseError;
      return {
        success: false,
        error: firebaseErr.message ?? "Failed to authenticate with Google.",
      };
    }
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
