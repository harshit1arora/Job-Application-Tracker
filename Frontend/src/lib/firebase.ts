import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";

/**
 * Firebase Web Configuration
 *
 * Configured securely via Vite environment variables (.env).
 * To connect your Firebase project, copy .env.example to .env and set your keys.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

// Initialize Firebase App singleton safely
const isConfigured = Boolean(firebaseConfig.apiKey);
const app = isConfigured
  ? (!getApps().length ? initializeApp(firebaseConfig) : getApp())
  : null;

export const auth = app ? getAuth(app) : (null as any);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export async function signInWithGooglePopup() {
  if (!auth) {
    return {
      success: false,
      error: "Firebase is not configured. Please create a .env file with your VITE_FIREBASE_API_KEY (see .env.example).",
      code: "auth/not-configured",
    };
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      success: true,
      user: {
        id: user.uid,
        name: user.displayName || user.email?.split("@")[0] || "Google User",
        email: user.email || "",
        avatar: user.photoURL || undefined,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error("Firebase Google Sign-In Error:", error);
    return {
      success: false,
      error: error.message || "Failed to authenticate with Google.",
      code: error.code,
    };
  }
}

export async function signOutFirebase() {
  if (!auth) return;
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Firebase Sign-Out Error:", error);
  }
}
