import { useCallback, useEffect, useRef, useState } from "react";
import { X, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeech } from "@/lib/use-voice";
import { toast } from "sonner";

type Phase = "idle" | "listening" | "thinking" | "speaking";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognitionCtor(): (new () => Recognition) | undefined {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Full-screen, ChatGPT-style voice conversation overlay. */
export function VoiceOverlay({
  open,
  onClose,
  onSend,
  busy,
  reply,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  busy: boolean;
  reply: { id: string; text: string } | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [muted, setMuted] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<Recognition | null>(null);
  const spokenRef = useRef<string | null>(null);
  const { speak, stop: stopSpeaking } = useSpeech();

  const stopListening = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    if (recRef.current) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i]?.[0]?.transcript ?? "";
      setHeard(text);
    };
    rec.onerror = () => {
      recRef.current = null;
      setPhase("idle");
    };
    rec.onend = () => {
      recRef.current = null;
      setHeard((current) => {
        const text = current.trim();
        if (text) {
          setPhase("thinking");
          onSend(text);
        } else {
          setPhase("idle");
        }
        return "";
      });
    };
    recRef.current = rec;
    setHeard("");
    setPhase("listening");
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setPhase("idle");
    }
  }, [onSend]);

  // Open / close lifecycle.
  useEffect(() => {
    if (!open) {
      stopListening();
      stopSpeaking();
      setPhase("idle");
      setHeard("");
      return;
    }
    spokenRef.current = reply?.id ?? null;
    startListening();
    return () => {
      stopListening();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Speak each new reply, then listen again.
  useEffect(() => {
    if (!open || !reply || !reply.text || busy || reply.id === spokenRef.current) return;
    spokenRef.current = reply.id;
    setPhase("speaking");
    if (muted) {
      startListening();
      return;
    }
    let cancelled = false;
    speak(reply.text)
      .catch((e: Error) => toast(e.message || "Voice is unavailable."))
      .finally(() => {
        if (!cancelled && open) startListening();
      });
    return () => {
      cancelled = true;
    };
  }, [open, reply, busy, muted, speak, startListening]);

  useEffect(() => {
    if (open && busy && phase !== "thinking") setPhase("thinking");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const caption = !supported
    ? "Your browser can't listen — try Chrome."
    : phase === "listening"
      ? heard || "Listening…"
      : phase === "thinking"
        ? "Thinking…"
        : phase === "speaking"
          ? "Aria is speaking…"
          : "Tap the orb to talk";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close voice mode"
        className="absolute right-5 top-5 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => {
          if (phase === "listening") stopListening();
          else if (phase === "speaking") {
            stopSpeaking();
            startListening();
          } else startListening();
        }}
        aria-label="Toggle listening"
        className="relative flex h-56 w-56 items-center justify-center rounded-full outline-none"
      >
        <span
          className={cn(
            "absolute inset-0 rounded-full bg-primary/20 blur-2xl transition-all duration-700",
            phase === "listening" && "animate-pulse bg-primary/30",
            phase === "speaking" && "animate-pulse bg-primary/40 scale-110",
          )}
        />
        <span
          className={cn(
            "absolute inset-6 rounded-full border border-primary/30 transition-all duration-700",
            phase === "listening" && "scale-110 border-primary/60",
            phase === "thinking" && "animate-spin border-dashed border-primary/50",
          )}
        />
        <span
          className={cn(
            "relative h-32 w-32 rounded-full bg-[radial-gradient(circle_at_30%_25%,hsl(var(--primary)/0.95),hsl(var(--primary)/0.35)_60%,transparent_75%)] shadow-[0_0_80px_-10px_hsl(var(--primary)/0.7)] transition-transform duration-500",
            phase === "listening" && "scale-105",
            phase === "speaking" && "scale-110 animate-pulse",
            phase === "idle" && "opacity-70",
          )}
        />
      </button>

      <p className="mt-10 max-w-md px-6 text-center text-sm text-muted-foreground">{caption}</p>

      <div className="mt-10 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setMuted((m) => !m);
            stopSpeaking();
          }}
          aria-label={muted ? "Unmute Aria" : "Mute Aria"}
          className={cn(
            "rounded-full border border-border p-3 transition hover:bg-muted",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          End voice chat
        </button>
      </div>
    </div>
  );
}
