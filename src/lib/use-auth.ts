// Local-only auth stub — no Firebase required.
// Uses a stable per-browser "guest" identity so threads.ts keeps its API surface.

const GUEST_KEY = "aria.guest.uid";

function getGuestId(): string {
  if (typeof window === "undefined") return "guest";
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = "guest-" + crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

export function useAuth() {
  const uid = typeof window === "undefined" ? "guest" : getGuestId();
  return {
    user: { uid } as { uid: string },
    loading: false,
    signInGoogle: async () => {},
    signOut: async () => {},
  };
}
