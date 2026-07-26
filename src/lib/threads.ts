import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import type { UIMessage } from "ai";

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
};

function threadsCol(uid: string) {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase not configured");
  return collection(fb.db, "users", uid, "threads");
}

export async function createThread(uid: string, id: string, title = "New chat") {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase not configured");
  await setDoc(doc(fb.db, "users", uid, "threads", id), {
    title,
    updatedAt: Date.now(),
    createdAt: serverTimestamp(),
  });
}

export function subscribeThreads(uid: string, cb: (t: Thread[]) => void) {
  const q = query(threadsCol(uid), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        title: (d.data().title as string) ?? "New chat",
        updatedAt: (d.data().updatedAt as number) ?? 0,
      })),
    );
  });
}

export async function renameThread(uid: string, id: string, title: string) {
  const fb = getFirebase();
  if (!fb) return;
  await updateDoc(doc(fb.db, "users", uid, "threads", id), { title, updatedAt: Date.now() });
}

export async function deleteThread(uid: string, id: string) {
  const fb = getFirebase();
  if (!fb) return;
  const msgs = await getDocs(collection(fb.db, "users", uid, "threads", id, "messages"));
  await Promise.all(msgs.docs.map((m) => deleteDoc(m.ref)));
  await deleteDoc(doc(fb.db, "users", uid, "threads", id));
}

export async function loadMessages(uid: string, threadId: string): Promise<UIMessage[]> {
  const fb = getFirebase();
  if (!fb) return [];
  const q = query(
    collection(fb.db, "users", uid, "threads", threadId, "messages"),
    orderBy("createdAt", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().message as UIMessage);
}

export async function saveMessage(uid: string, threadId: string, message: UIMessage) {
  const fb = getFirebase();
  if (!fb) return;
  await addDoc(collection(fb.db, "users", uid, "threads", threadId, "messages"), {
    message,
    createdAt: Date.now(),
  });
  await updateDoc(doc(fb.db, "users", uid, "threads", threadId), { updatedAt: Date.now() });
}
