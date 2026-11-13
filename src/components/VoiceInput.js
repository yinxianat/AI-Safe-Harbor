"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context.js";

/**
 * Microphone button that streams speech-to-text into a callback.
 *
 * Uses the Web Speech API (SpeechRecognition), which runs entirely in the
 * browser — no server round-trip, no API key. Safari, Chrome and Edge support
 * it; Firefox does not. On unsupported browsers the button is hidden.
 */
export default function VoiceInput({ onTranscript, disabled, className = "" }) {
  const { t, locale } = useT();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      recRef.current?.stop();
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = locale === "zh-CN" ? "zh-CN" : "en-US";
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript;
      if (text) onTranscript(text);
    };

    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, locale, onTranscript]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? t("voice_stop") : t("voice_start")}
      className={`inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-50
        ${listening
          ? "bg-red-50 text-red-600 border border-red-200"
          : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"
        } ${className}`}
    >
      {listening ? (
        // Pulsing dot while recording
        <span className="relative flex h-4 w-4 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
        </svg>
      )}
    </button>
  );
}
