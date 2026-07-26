import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { getFirebase, googleProvider } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(fb.auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return {
    user,
    loading,
    signInGoogle: async () => {
      const fb = getFirebase();
      if (!fb) throw new Error("Firebase not configured");
      await signInWithPopup(fb.auth, googleProvider);
    },
    signOut: async () => {
      const fb = getFirebase();
      if (!fb) return;
      await signOut(fb.auth);
    },
  };
}
