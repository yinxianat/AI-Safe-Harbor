"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/context.js";
import Avatar from "@/components/Avatar.js";
import { relationshipLabelKey } from "@/lib/relationships.js";

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
              <Avatar
                src={c.partnerAvatarUrl}
                name={c.partnerName}
                size="sm"
                tone={active ? "emerald" : "slate"}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${active ? "text-emerald-900" : "text-slate-800"}`}>
                  {c.partnerName}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {c.relationshipType ? t(relationshipLabelKey(c.relationshipType)) : t("rel_connection_generic")}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
