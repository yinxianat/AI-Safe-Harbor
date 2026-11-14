"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";
import Avatar from "@/components/Avatar.js";
import { relationshipLabelKey } from "@/lib/relationships.js";
import { toneShortLabelKey } from "@/lib/tones.js";
import { useTimeAgo } from "@/lib/time-ago.js";

// A card line long enough to read at a glance but short enough that the card
// does not grow with every status edit. A longer status is available on the
// profile the card links to.
const STATUS_PREVIEW_MAX = 90;

function statusPreview(text) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > STATUS_PREVIEW_MAX
    ? clean.slice(0, STATUS_PREVIEW_MAX - 1).trimEnd() + "…"
    : clean;
}

/**
 * One contact's row in the chat list.
 *
 * Two active surfaces that have to not fight each other: the row as a whole
 * is a link to the conversation (unchanged from before), and the small avatar
 * button in the top-left opens the contact's profile. The chevron on the
 * right still means "open the chat"; the avatar button means "see who they
 * are". Two destinations, two affordances.
 *
 * The status line is deliberately short — one preview, truncated — because
 * the card is a navigation surface, not a reading surface. A longer status
 * is on the profile the avatar button opens.
 */
function ChatCard({ c, t }) {
  const timeAgo = useTimeAgo();
  const preview = statusPreview(c.statusText);
  // The tone shown on the card is the one THEIR messages come to me in on
  // this connection — which is the receiver's own preference. That is
  // "partnerTonePreference" on this payload: the partner's choice, not mine.
  const toneKey = c.partnerTonePreference;

  return (
    <div className="relative rounded-xl sm:rounded-2xl bg-white shadow-sm overflow-hidden">
      <Link
        href={`/chat/${c.id}`}
        className="flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3.5 active:bg-emerald-50 transition-colors"
        aria-label={t("chat_open_conversation", { name: c.partnerName })}
      >
        {/* Avatar is NOT the link to the chat. It is its own button to the
            profile — the whole point of adding it here. Stopping propagation
            keeps it from also triggering the surrounding Link. */}
        <Link
          href={`/them?connectionId=${c.id}`}
          onClick={(e) => e.stopPropagation()}
          aria-label={t("chat_open_profile", { name: c.partnerName })}
          className="relative shrink-0 rounded-full ring-2 ring-transparent hover:ring-emerald-200 transition-shadow"
        >
          <Avatar src={c.partnerAvatarUrl} name={c.partnerName} size="md" tone="solid" />
          {/* The little badge makes the "it is a button, not decoration"
              affordance obvious on a card where the surrounding area is
              itself clickable. */}
          <span
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-600 text-white border-2 border-white flex items-center justify-center"
            aria-hidden="true"
          >
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </span>
        </Link>

        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold text-slate-900 truncate">{c.partnerName}</p>

          {/* Secondary line: real name under a nickname, plus relationship.
              Still identifies who the conversation is actually with. */}
          <p className="text-[11px] text-slate-500 truncate">
            {c.nickname && c.partnerRealName ? c.partnerRealName + " · " : null}
            {c.relationshipType ? t(relationshipLabelKey(c.relationshipType)) : t("rel_connection_generic")}
          </p>

          {/* Brief status line. Shown only when there is one, so quiet contacts
              do not grow a visually empty third row. */}
          {preview && (
            <p className="text-[11px] text-slate-600 truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
              <span className="truncate">{preview}</span>
              {c.statusUpdatedAt && (
                <span className="text-[10px] text-slate-400 shrink-0">· {timeAgo(c.statusUpdatedAt)}</span>
              )}
            </p>
          )}

          {/* The tone their messages come to me in. Kept here rather than on
              its own row — one more line would push the card toward feeling
              dense — so it sits next to the chevron where it is easy to miss
              but easy to find once you know to look. */}
          {toneKey && (
            <p className="text-[10px] text-slate-400 truncate">
              {t("chat_card_tone", { tone: t(toneShortLabelKey(toneKey)) })}
            </p>
          )}
        </div>

        <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

export default function ChatIndexPage() {
  const router = useRouter();
  const { t } = useT();
  const [connections, setConnections] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/connections");
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setConnections(data.connections || []);
        } else {
          setConnections([]);
        }
      } catch {
        if (!cancelled) setConnections([]);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (connections === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="space-y-6 pt-8">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{t("chat_no_conversations_title")}</h1>
          <p className="text-sm text-slate-500">{t("chat_no_conversations_hint")}</p>
          <Link
            href="/circle"
            className="inline-block bg-emerald-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors"
          >
            {t("chat_go_to_circle")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="full-bleed -mt-3 sm:-mt-5 min-h-[calc(100dvh-5rem)]"
      style={{ backgroundColor: "var(--surface-sunken)" }}
    >
      <div className="px-4 sm:px-5 pt-4 pb-2">
        <h1 className="text-lg font-bold text-slate-900">{t("conversations")}</h1>
      </div>
      <div className="px-3 sm:px-4 space-y-2 pb-4">
        {connections.map((c) => (
          <ChatCard key={c.id} c={c} t={t} />
        ))}
      </div>
    </div>
  );
}
