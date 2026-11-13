"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getReaction } from "@/lib/reactions.js";
import { useT } from "@/lib/i18n/context.js";
import Avatar from "@/components/Avatar.js";
import VoiceInput from "@/components/VoiceInput.js";

// ─── Helpers ────────────────────────────────────────────────────────

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function makeFormatDate(t) {
  return (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const oneDay = 86400000;

    if (diff < oneDay && d.getDate() === now.getDate()) return t("chat_day_today");
    if (diff < oneDay * 2) return t("chat_day_yesterday");

    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };
}

/** Group consecutive messages by calendar day for date separators. */
function groupByDay(messages, formatDate) {
  const groups = [];
  let currentDay = null;

  for (const msg of messages) {
    const day = msg.sentAt ? new Date(msg.sentAt).toDateString() : "unknown";
    if (day !== currentDay) {
      currentDay = day;
      groups.push({ day, label: formatDate(msg.sentAt), messages: [] });
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

// ─── Topic warnings ─────────────────────────────────────────────────

function TopicWarnings({ hints, text }) {
  const { t: tr } = useT();
  const detected = useMemo(() => {
    if (!text.trim() || hints.length === 0) return [];
    const lower = text.toLowerCase();
    return hints.filter((h) => h.keywords.some((kw) => lower.includes(kw)));
  }, [hints, text]);

  if (detected.length === 0 && text.trim().length > 0 && hints.length > 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        {tr("chat_no_boundary_topics")}
      </div>
    );
  }
  if (detected.length === 0) return null;

  return (
    <div className="space-y-1">
      {detected
        .filter((d) => d.level === "red")
        .map((topic) => (
          <div key={topic.topicName} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 mt-0.5 shrink-0" />
            <span>{tr("chat_topic_red", { label: topic.label })}</span>
          </div>
        ))}
      {detected
        .filter((d) => d.level === "yellow")
        .map((topic) => (
          <div key={topic.topicName} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 mt-0.5 shrink-0" />
            <span>{tr("chat_topic_yellow", { label: topic.label })}</span>
          </div>
        ))}
    </div>
  );
}

// ─── Chat Bubble ────────────────────────────────────────────────────

function ChatBubble({ message, partnerName, partnerAvatar, myName, myAvatar }) {
  const { t } = useT();
  const [showOriginal, setShowOriginal] = useState(false);
  const isSent = message.direction === "sent";
  const reactionData = message.reaction ? getReaction(message.reaction) : null;

  return (
    <div className={`flex gap-2 ${isSent ? "flex-row-reverse" : "flex-row"} items-end`}>
      <Avatar
        src={isSent ? myAvatar : partnerAvatar}
        name={isSent ? myName : partnerName}
        size="xs"
        tone={isSent ? "emerald" : "slate"}
      />

      <div className="max-w-[78%] sm:max-w-[75%] min-w-[60px]">
        {!isSent && (
          <p className="text-[11px] text-slate-400 mb-0.5 ml-1">{partnerName}</p>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
            isSent
              ? "bg-emerald-600 text-white rounded-br-md"
              : "bg-white border border-gray-200 text-slate-800 rounded-bl-md"
          }`}
        >
          {message.content}
        </div>

        {isSent && message.contentRaw && message.contentRaw !== message.content && (
          <div className="mt-1 text-right">
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className="text-[11px] text-emerald-400 hover:text-emerald-600 transition-colors"
            >
              {showOriginal ? t("chat_hide_original") : t("chat_show_original")}
            </button>
            {showOriginal && (
              <div className="mt-1 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-800 text-left">
                {message.contentRaw}
              </div>
            )}
          </div>
        )}

        {!isSent && reactionData && (
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
              {reactionData.emoji} <span className="text-slate-500">{reactionData.label}</span>
            </span>
          </div>
        )}

        {isSent && reactionData && (
          <div className="mt-1 text-right">
            <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
              {reactionData.emoji} <span className="text-emerald-600">{reactionData.label}</span>
            </span>
          </div>
        )}

        <p className={`text-[11px] mt-0.5 ${isSent ? "text-right text-slate-400" : "text-slate-400"} flex items-center gap-1 ${isSent ? "justify-end" : ""}`}>
          <span>{formatTime(message.sentAt)}</span>
          {isSent && (
            message.readAt ? (
              <span className="text-emerald-500" aria-label="read">✓✓</span>
            ) : message.sentAt ? (
              <span className="text-slate-400" aria-label="sent">✓</span>
            ) : (
              <span className="text-slate-300" aria-label="sending">⏱</span>
            )
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Compose Bar ────────────────────────────────────────────────────

function ComposeBar({ connectionId, onMessageSent }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [tuning, setTuning] = useState(false);
  const [sending, setSending] = useState(false);
  const [tuneResult, setTuneResult] = useState(null);
  const [error, setError] = useState(null);
  const [hints, setHints] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!connectionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/compose/topic-hints?connectionId=${connectionId}`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setHints(data.hints || []);
        }
      } catch { /* hints are best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [connectionId]);

  // Auto-resize the textarea as the user types.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [text]);

  async function handleTune() {
    if (!text.trim()) return;
    setTuning(true);
    setError(null);
    setTuneResult(null);
    try {
      const res = await fetch("/api/messages/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, contentRaw: text }),
      });
      if (!res.ok && res.status >= 500) {
        setError(t("chat_server_error"));
        setTuning(false);
        return;
      }
      const data = await res.json();
      if (data.held) {
        setTuneResult({
          type: "held",
          reason: data.heldReason,
          topics: data.topics,
          aiReasons: data.aiReasons,
        });
      } else {
        setTuneResult({
          type: "ready",
          messageId: data.messageId,
          raw: text,
          rephrased: data.rephrased,
          topicVerdict: data.topicVerdict,
        });
      }
    } catch {
      setError(t("chat_network_error"));
    }
    setTuning(false);
  }

  async function handleSend() {
    if (!tuneResult?.messageId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: tuneResult.messageId, versionSent: "rephrased" }),
      });
      if (res.ok) {
        setText("");
        setTuneResult(null);
        onMessageSent();
      } else {
        setError(t("chat_could_not_send"));
      }
    } catch {
      setError(t("chat_network_error"));
    }
    setSending(false);
  }

  function handleDismissResult() {
    setTuneResult(null);
  }

  // Held state: message was blocked by boundaries.
  if (tuneResult?.type === "held") {
    return (
      <div className="border-t border-gray-200 bg-white px-4 py-3 space-y-2">
        <div className={`rounded-xl p-3 border text-sm ${
          tuneResult.reason === "red_topic"
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}>
          <p className="font-medium">
            {tuneResult.reason === "red_topic" ? t("chat_message_held") : t("chat_saved_draft")}
          </p>
          <p className="text-xs mt-1">
            {tuneResult.reason === "red_topic"
              ? t("chat_touches_sensitive", {
                  topics: tuneResult.topics?.length
                    ? t("chat_touches_sensitive_with", { topics: tuneResult.topics.join(", ") })
                    : "",
                })
              : t("chat_ai_unavailable")}
          </p>
          {tuneResult.aiReasons?.length > 0 && (
            <ul className="text-xs mt-2 space-y-1 opacity-80">
              {tuneResult.aiReasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { handleDismissResult(); setText(""); }} className="text-xs font-medium text-emerald-600">
            {t("chat_write_else")}
          </button>
          <button onClick={handleDismissResult} className="text-xs text-slate-400">
            {t("chat_back_editing")}
          </button>
        </div>
      </div>
    );
  }

  // Preview state: tuned message ready to send.
  if (tuneResult?.type === "ready") {
    return (
      <div className="border-t border-gray-200 bg-white px-4 py-3 space-y-2">
        {tuneResult.topicVerdict?.status === "clear" && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-medium">{t("chat_ai_check_passed")}</span> — {t("chat_good_to_send")}
          </div>
        )}
        {tuneResult.topicVerdict?.status === "caution" && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="font-medium">{t("chat_gentle_noted")}</span> — {t("chat_ai_softened")}
          </div>
        )}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <p className="text-xs font-medium text-emerald-400 uppercase mb-1">{t("chat_tuned_version")}</p>
          <p className="text-sm text-emerald-900">{tuneResult.rephrased}</p>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {sending ? t("sending") : t("send")}
          </button>
          <button
            onClick={handleDismissResult}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            {t("edit")}
          </button>
        </div>
      </div>
    );
  }

  // Default: text input with Tune button.
  return (
    <div className="border-t border-gray-200 bg-white px-3 py-2 space-y-1.5">
      {hints.length > 0 && text.trim().length > 0 && (
        <TopicWarnings hints={hints} text={text} />
      )}
      {error && <p className="text-xs text-red-600 px-1">{error}</p>}
      <div className="flex items-end gap-1.5">
        <VoiceInput
          onTranscript={(spoken) => setText((prev) => prev ? `${prev} ${spoken}` : spoken)}
          disabled={tuning}
          className="p-2.5 shrink-0 min-h-[40px]"
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat_write_message")}
          rows={1}
          maxLength={5000}
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent min-h-[40px] max-h-[120px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && text.trim()) {
              e.preventDefault();
              handleTune();
            }
          }}
        />
        <button
          onClick={handleTune}
          disabled={tuning || !text.trim()}
          className="bg-emerald-600 text-white text-sm font-medium px-3 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shrink-0 min-h-[44px]"
        >
          {tuning ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t("chat_tuning")}
            </span>
          ) : (
            t("chat_ai_tune")
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function ChatThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useT();
  const connectionId = params.connectionId;

  const [messages, setMessages] = useState([]);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [me, setMe] = useState(null);

  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  const fetchThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages/thread?connectionId=${connectionId}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError("forbidden");
        } else {
          setError("load_failed");
        }
        return;
      }
      const data = await res.json();
      setMessages(data.messages || []);
      setPartner(data.partner || null);
    } catch {
      setError("network");
    }
  }, [connectionId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (!cancelled && meRes.ok) {
          setMe(await meRes.json());
        }
      } catch { /* non-critical */ }

      await fetchThread();
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [fetchThread]);

  // Poll for new messages every 15 seconds.
  useEffect(() => {
    const id = setInterval(fetchThread, 15000);
    return () => clearInterval(id);
  }, [fetchThread]);

  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [showJumpButton, setShowJumpButton] = useState(false);

  useEffect(() => {
    if (loading || !bottomRef.current || !containerRef.current) return;
    if (!initialScrollDone) {
      bottomRef.current.scrollIntoView({ behavior: "auto" });
      setInitialScrollDone(true);
      return;
    }
    const el = containerRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading, messages.length, initialScrollDone]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onScroll() {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowJumpButton(distanceFromBottom > 400);
    }
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [initialScrollDone]);

  function scrollToLatest() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleMessageSent() {
    fetchThread();
  }

  const myName = me?.displayName || (me?.username ? `@${me.username}` : t("me_fallback_name"));
  const partnerName = partner?.name || t("chat_them_fallback");
  const formatDate = makeFormatDate(t);

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-5rem)]">
        <div className="flex justify-center items-center flex-1">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error === "forbidden") {
    return (
      <div className="space-y-4 pt-4">
        <Link href="/circle" className="text-sm text-emerald-600 font-medium">{t("tuning_back_to_circle")}</Link>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{t("chat_forbidden")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 pt-4">
        <Link href="/circle" className="text-sm text-emerald-600 font-medium">{t("tuning_back_to_circle")}</Link>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <p>{error === "network" ? t("chat_network_error") : t("chat_load_failed")}</p>
          <button onClick={() => { setError(null); setLoading(true); fetchThread().then(() => setLoading(false)); }} className="text-xs font-medium underline mt-1">
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  const dayGroups = groupByDay(messages, formatDate);

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] full-bleed -mt-3 sm:-mt-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={() => router.push("/chat")}
          className="text-emerald-600 hover:text-emerald-800 transition-colors shrink-0 p-1"
          aria-label={t("chat_back")}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Avatar src={partner?.avatarUrl} name={partnerName} size="sm" />
          <p className="text-sm font-semibold text-slate-900 truncate">{partnerName}</p>
        </div>
        <Link
          href={`/circle/settings?connectionId=${connectionId}`}
          className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors shrink-0"
          aria-label={t("tuning_title")}
        >
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </Link>
        <Link
          href={`/them?connectionId=${connectionId}`}
          className="text-xs text-emerald-600 font-medium hover:text-emerald-800 shrink-0"
        >
          {t("chat_profile_link")}
        </Link>
      </div>

      {/* Messages area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50 relative">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("chat_no_messages_yet")}</p>
            <p className="text-xs text-slate-400 mt-1">
              {t("chat_send_first", { name: partnerName })}
            </p>
          </div>
        )}

        {dayGroups.map((group) => (
          <div key={group.day} className="space-y-3">
            {/* Day separator */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{group.label}</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {group.messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                partnerName={partnerName}
                partnerAvatar={partner?.avatarUrl}
                myName={myName}
                myAvatar={me?.avatarUrl}
              />
            ))}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Jump-to-latest floating button */}
      {showJumpButton && (
        <button
          onClick={scrollToLatest}
          className="absolute right-4 bottom-20 z-20 bg-white border border-gray-200 shadow-lg rounded-full px-3 py-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          aria-label={t("chat_latest")}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          {t("chat_latest")}
        </button>
      )}

      <div className="shrink-0">
        <ComposeBar connectionId={connectionId} onMessageSent={handleMessageSent} />
      </div>
    </div>
  );
}
