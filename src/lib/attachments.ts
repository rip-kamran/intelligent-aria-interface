import { supabase } from "@/integrations/supabase/client";
import type { PlanId } from "@/lib/aria-prompts";

/** Hard caps for anything a user attaches to a message. */
export const MAX_FILE_BYTES = 350 * 1024 * 1024; // 350 MB
export const MAX_VIDEO_SECONDS = 70; // 1:10

export const ATTACHMENT_LIMITS: Record<PlanId, number> = {
  free: 4,
  pro: 10,
  max: 20,
  enterprise: 50,
};

export function maxAttachments(plan: PlanId): number {
  return ATTACHMENT_LIMITS[plan] ?? 4;
}

export type Attachment = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  url: string;
  previewUrl?: string;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    const done = (v: number) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    el.onloadedmetadata = () => done(el.duration || 0);
    el.onerror = () => done(0);
    el.src = url;
  });
}

/** Validates one file against the size / duration rules. Returns an error string, or null. */
export async function validateFile(file: File): Promise<string | null> {
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)} — the limit is 350 MB.`;
  }
  if (file.type.startsWith("video/")) {
    const seconds = await videoDuration(file);
    if (seconds > MAX_VIDEO_SECONDS + 0.5) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `"${file.name}" is ${mins}:${String(secs).padStart(2, "0")} long — videos must be 1:10 or shorter.`;
    }
  }
  return null;
}

/** Uploads a validated file to the user's private folder and returns a long-lived signed link. */
export async function uploadAttachment(
  file: File,
  userId: string,
  threadId: string,
): Promise<Attachment> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
  const path = `${userId}/${threadId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from("chat-attachments")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message);

  const { data, error: signErr } = await supabase.storage
    .from("chat-attachments")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr || !data?.signedUrl) throw new Error(signErr?.message ?? "Could not link that file.");

  return {
    id: path,
    name: file.name,
    mediaType: file.type || "application/octet-stream",
    size: file.size,
    url: data.signedUrl,
  };
}
