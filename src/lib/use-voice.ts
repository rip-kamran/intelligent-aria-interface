import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Speaks text with Aria's ElevenLabs voice. */
export function useSpeech() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const clean = text.replace(/```[\s\S]*?```/g, " code block ").replace(/[*_#>`]/g, "").trim();
      if (!clean) return;
      stop();
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(data.session?.access_token
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Voice unavailable");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setSpeaking(true);
      // Resolve only once playback has actually finished, so callers never
      // re-open the microphone while Aria is still talking.
      await new Promise<void>((resolve) => {
        const done = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
          if (audioRef.current === audio) audioRef.current = null;
          resolve();
        };
        audio.onended = done;
        audio.onerror = done;
        audio.onpause = () => {
          if (!audio.ended) done();
        };
        audio.play().catch(done);
      });
    },
    [stop],
  );

  useEffect(() => () => audioRef.current?.pause(), []);

  return { speak, stop, speaking };
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

/** Microphone dictation using the browser's built-in speech recognition. */
export function useDictation(onText: (text: string) => void) {
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const toggle = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i]?.[0]?.transcript ?? "";
      if (text.trim()) onText(text.trim());
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    rec.onerror = () => {
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [onText]);

  return { toggle, listening, supported };
}
