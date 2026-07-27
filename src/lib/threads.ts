import type { UIMessage } from "ai";

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
};

const THREADS_KEY = "aria.threads.v1";
const MSGS_PREFIX = "aria.messages.v1.";

type Listener = (threads: Thread[]) => void;
const listeners = new Set<Listener>();

function readThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Thread[];
    return arr.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeThreads(threads: Thread[]) {
  localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
  listeners.forEach((l) => l(sorted));
}

export async function createThread(_uid: string, id: string, title = "New chat") {
  const threads = readThreads();
  if (threads.find((t) => t.id === id)) return;
  threads.push({ id, title, updatedAt: Date.now() });
  writeThreads(threads);
}

export function subscribeThreads(_uid: string, cb: (t: Thread[]) => void) {
  cb(readThreads());
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THREADS_KEY) cb(readThreads());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export async function renameThread(_uid: string, id: string, title: string) {
  const threads = readThreads();
  const t = threads.find((x) => x.id === id);
  if (!t) return;
  t.title = title;
  t.updatedAt = Date.now();
  writeThreads(threads);
}

export async function deleteThread(_uid: string, id: string) {
  const threads = readThreads().filter((t) => t.id !== id);
  writeThreads(threads);
  localStorage.removeItem(MSGS_PREFIX + id);
}

export async function loadMessages(_uid: string, threadId: string): Promise<UIMessage[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MSGS_PREFIX + threadId);
    return raw ? (JSON.parse(raw) as UIMessage[]) : [];
  } catch {
    return [];
  }
}

export async function saveMessage(_uid: string, threadId: string, message: UIMessage) {
  const existing = await loadMessages(_uid, threadId);
  existing.push(message);
  localStorage.setItem(MSGS_PREFIX + threadId, JSON.stringify(existing));
  const threads = readThreads();
  const t = threads.find((x) => x.id === threadId);
  if (t) {
    t.updatedAt = Date.now();
    writeThreads(threads);
  }
}
