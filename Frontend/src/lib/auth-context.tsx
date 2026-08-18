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
    if (!auth) {
      // Firebase not configured — running without authentication
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const targetRole = localStorage.getItem(TARGET_ROLE_KEY) ?? DEMO_FALLBACK_ROLE;
        setUser({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          email: firebaseUser.email ?? "",
          targetRole,
          createdAt: firebaseUser.metadata.creationTime ?? new Date().toISOString(),
          // Spread avatar conditionally to satisfy exactOptionalPropertyTypes
          ...(firebaseUser.photoURL ? { avatar: firebaseUser.photoURL } : {}),
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    // Clean up the listener when AuthProvider unmounts
    return unsubscribe;
  }, []);

  // ---------------------------------------------------------------------------
  // login — Firebase Email/Password Sign-In
  // ---------------------------------------------------------------------------
  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!auth) return { success: false, error: mapFirebaseError("auth/not-configured") };

    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      // onAuthStateChanged will handle setting the user state
      return { success: true };
    } catch (err) {
      const firebaseErr = err as FirebaseError;
      return { success: false, error: mapFirebaseError(firebaseErr.code) };
    }
  };

  // ---------------------------------------------------------------------------
  // signup — Firebase Email/Password Account Creation
  // ---------------------------------------------------------------------------
  const signup = async (data: {
    name: string;
    email: string;
    password: string;
    targetRole?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!auth) return { success: false, error: mapFirebaseError("auth/not-configured") };

    try {
      // Step 1: Create the Firebase Auth account
      const credential = await createUserWithEmailAndPassword(
        auth,
        data.email.trim().toLowerCase(),
        data.password
      );

      // Step 2: Set the display name
      // Firebase Auth stores email/password separately from profile data.
      // We call updateProfile to attach the user's name to their account.
      await updateProfile(credential.user, { displayName: data.name.trim() });

      // Step 3: Persist targetRole preference
      const targetRole = data.targetRole?.trim() || DEMO_FALLBACK_ROLE;
      localStorage.setItem(TARGET_ROLE_KEY, targetRole);

      // Step 4: Manually update React state
      // onAuthStateChanged has already fired (before updateProfile resolved),
      // so displayName was null at that point. We set the final state manually
      // so the UI immediately shows the correct name without waiting for reload.
      setUser({
        id: credential.user.uid,
        name: data.name.trim(),
        email: credential.user.email ?? data.email.trim().toLowerCase(),
        targetRole,
        createdAt: credential.user.metadata.creationTime ?? new Date().toISOString(),
      });

      return { success: true };
    } catch (err) {
      const firebaseErr = err as FirebaseError;
      return { success: false, error: mapFirebaseError(firebaseErr.code) };
    }
  };

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------
  const logout = (): void => {
    void signOutFirebase(); // fires async sign-out; onAuthStateChanged sets user→null
    localStorage.removeItem(TARGET_ROLE_KEY);
    setUser(null); // immediate UI response — don't wait for onAuthStateChanged
  };

  // ---------------------------------------------------------------------------
  // demoLogin — Signs into the demo account, creating it first if needed
  // ---------------------------------------------------------------------------
  /**
   * For viva:
   * The demo account is a real Firebase Auth user (demo@jobpilot.ai / password123).
   * On first call, we create the account if it doesn't exist in Firebase Auth.
   * On subsequent calls, we just sign in normally.
   *
   * Return type is void (as declared in AuthContextType) because all call sites
   * fire-and-forget: demoLogin(); navigate("/dashboard");
   * The navigation and loading state handle the async gap gracefully.
   */
  const demoLogin = (): void => {
    if (!auth) return;

    // Fire and forget — callers do not await demoLogin()
    void (async () => {
      try {
        // First, try to sign in (covers the common case)
        await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
        if (!localStorage.getItem(TARGET_ROLE_KEY)) {
          localStorage.setItem(TARGET_ROLE_KEY, DEMO_TARGET_ROLE);
        }
      } catch {
        // Sign-in failed — demo account likely doesn't exist yet; create it
        try {
          const credential = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
          await updateProfile(credential.user, { displayName: DEMO_NAME });
          localStorage.setItem(TARGET_ROLE_KEY, DEMO_TARGET_ROLE);
        } catch {
          // Demo account may have just been created by a concurrent call —
          // try signing in one more time before giving up silently
          try {
            await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
          } catch {
            // Silent fail — demo mode is a convenience feature, not critical
          }
        }
      }
    })();
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
