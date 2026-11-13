"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n/context.js";
import Avatar from "@/components/Avatar.js";

const REL_KEY = {
  spouse: "rel_partner",
  partner: "rel_partner",
  friend: "rel_friend",
  sibling: "rel_sibling",
  parent: "rel_parent",
  child: "rel_child",
  coworker: "rel_coworker",
  roommate: "rel_roommate",
  other: "rel_other",
};

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
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className="flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white shadow-sm active:bg-emerald-50 transition-colors"
          >
            <Avatar src={c.partnerAvatarUrl} name={c.partnerName} size="md" tone="solid" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{c.partnerName}</p>
              <p className="text-xs text-slate-500 truncate">
                {/* Their own name stays on screen under a relabel, so the row
                    still identifies who the conversation is actually with. */}
                {c.nickname && c.partnerRealName ? c.partnerRealName : null}
                {c.nickname && c.partnerRealName ? " · " : null}
                {c.relationshipType ? t(REL_KEY[c.relationshipType] || "rel_connection_generic") : t("rel_connection_generic")}
              </p>
            </div>
            <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
