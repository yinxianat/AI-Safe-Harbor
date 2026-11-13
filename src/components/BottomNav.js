"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useT } from "@/lib/i18n/context.js";
import { useUser } from "@/lib/user/context.js";

function NavIcon({ icon, active }) {
  const color = active ? "text-emerald-600" : "text-gray-400";

  if (icon === "circle") {
    return (
      <svg className={`w-6 h-6 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 11-3-3" />
      </svg>
    );
  }

  if (icon === "chat") {
    return (
      <svg className={`w-6 h-6 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }

  if (icon === "me") {
    return (
      <svg className={`w-6 h-6 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    );
  }

  if (icon === "admin") {
    return (
      <svg className={`w-6 h-6 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    );
  }

  return null;
}

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  const user = useUser();
  const [unread, setUnread] = useState(0);

  const navItems = useMemo(() => {
    const items = [
      { href: "/circle", labelKey: "nav_circle", icon: "circle" },
      { href: "/chat", labelKey: "nav_chat", icon: "chat" },
      { href: "/me", labelKey: "nav_me", icon: "me" },
    ];
    if (user?.isAdmin) {
      items.push({ href: "/admin", labelKey: "nav_admin", icon: "admin" });
    }
    return items;
  }, [user?.isAdmin]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/messages/unread");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setUnread(data.unread || 0);
        }
      } catch { /* ignore */ }
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)] z-50">
      <div className="flex justify-around items-center h-16 max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-[env(safe-area-inset-left)]">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-0 min-h-[44px] px-2 sm:px-3 py-1 rounded-lg transition-colors relative ${
                active ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <div className="relative">
                <NavIcon icon={item.icon} active={active} />
                {item.icon === "chat" && unread > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1 font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
