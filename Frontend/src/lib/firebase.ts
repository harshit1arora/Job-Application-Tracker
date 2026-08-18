import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";

/**
 * Firebase Web Configuration
 *
 * NOTE: These are CLIENT-SIDE Firebase web config values, NOT secret keys.
 * Firebase web API keys are PUBLIC by design and are safe to commit to source control.
 * Security is enforced via Firebase Security Rules, App Check, and domain restrictions —
 * not by hiding these values. See: https://firebase.google.com/docs/projects/api-keys
 *
 * To use your own Firebase project, set the VITE_FIREBASE_* environment variables
 * in a .env file (see .env.example). Otherwise, the defaults below will be used.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAjcztD4fIYZBF51eYOJYY7bw1ME7dbajA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-parking-app-java.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smart-parking-app-java",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-parking-app-java.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "222772834466",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:222772834466:web:3ce2f69aaad4917b10a7fb",
};

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export async function signInWithGooglePopup() {
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
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Firebase Sign-Out Error:", error);
  }
}
