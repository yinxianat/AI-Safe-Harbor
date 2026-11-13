"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/context.js";

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

function initials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

/**
 * Desktop-only sidebar listing all connections. Appears alongside the
 * chat thread on wider screens. Highlights the active connection.
 */
export default function ChatSidebar({ activeConnectionId }) {
  const { t } = useT();
  const [connections, setConnections] = useState([]);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/connections");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setConnections(data.connections || []);
        }
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  if (connections.length === 0) return null;

  return (
    <aside className="hidden lg:flex flex-col w-72 border-r border-gray-200 bg-white shrink-0 overflow-y-auto">
      <div className="px-4 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{t("conversations")}</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {connections.map((c) => {
          const active = c.id === activeConnectionId;
          return (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                active
                  ? "bg-emerald-50 border-l-2 border-emerald-600"
                  : "hover:bg-slate-50 border-l-2 border-transparent"
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}>
                {initials(c.partnerName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${active ? "text-emerald-900" : "text-slate-800"}`}>
                  {c.partnerName}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {c.relationshipType ? t(REL_KEY[c.relationshipType] || "rel_connection_generic") : t("rel_connection_generic")}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
