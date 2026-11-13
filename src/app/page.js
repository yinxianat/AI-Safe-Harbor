"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { validateEmailShape, suggestCorrection } from "@/lib/email-hints.js";
import { useT } from "@/lib/i18n/context.js";

const RESEND_COOLDOWN_SECONDS = 30;

const ERROR_MESSAGES = {
  expired: "That link has expired. Request a new one below.",
  consumed: "That link has already been used. Request a new one below.",
  missing_token: "That link was incomplete. Request a new one below.",
  invalid_token: "That link is not valid. Request a new one below.",
  wrong_purpose: "That link cannot be used to sign in. Request a new one below.",
  inviter_not_found: "That invitation is no longer valid. Ask for a new one.",
  cannot_invite_self: "You cannot connect with yourself.",
};

// Isolated because useSearchParams opts a component out of prerendering.
// Keeping it to this one banner means the rest of the page is still server
// rendered — otherwise the whole landing page is a spinner until hydration.
function ErrorBanner() {
  const error = useSearchParams().get("error");
  if (!error) return null;

  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
      {ERROR_MESSAGES[error] || "Something went wrong. Please try again."}
    </div>
  );
}

function useCountdown(until) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!until) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    const quick = setTimeout(tick, 10);
    const id = setInterval(tick, 500);
    return () => {
      clearTimeout(quick);
      clearInterval(id);
    };
  }, [until]);

  return until ? remaining : 0;
}

function SignInForm() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [undeliverable, setUndeliverable] = useState(false);
  const inFlight = useRef(false);

  const cooldown = useCountdown(cooldownUntil);

  async function send(address) {
    // A double-click must not produce two links; the first invalidates nothing
    // but the second email confuses the recipient.
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setProblem(null);

    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const wait = data.retryAfter || 60;
        setProblem(`Too many requests. Please wait ${wait} seconds before trying again.`);
        setCooldownUntil(Date.now() + wait * 1000);
        return;
      }

      if (!res.ok) {
        setProblem("We could not send the link just now. Please try again in a moment.");
        return;
      }

      // The server reports mail-system health, not anything about this
      // address, so acting on it cannot reveal whether the account exists.
      const body = await res.json().catch(() => ({}));
      setUndeliverable(Boolean(body.deliveryDegraded));
      setSentTo(address);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch {
      // The request may still have been delivered, so do not claim it failed.
      setProblem(
        "We lost the connection before we could confirm. Check your inbox first — if nothing arrives, try again."
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();

    const check = validateEmailShape(email);
    if (!check.ok) {
      setProblem(check.message);
      return;
    }

    // A typo is the most likely reason a link "never arrives", and it is
    // invisible after sending — so ask before, not after.
    const maybe = suggestCorrection(check.email);
    if (maybe && maybe !== suggestion) {
      setSuggestion(maybe);
      return;
    }

    send(check.email);
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        {undeliverable ? (
          // Telling someone to check their inbox when the mail system is known
          // to be down is the single most confusing thing this page can do: it
          // reads as "your address is wrong" and sends them to look for a
          // message that does not exist.
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
            <p className="font-medium text-red-800">We couldn&rsquo;t send your sign-in link</p>
            <p className="mt-2 text-sm text-red-700">
              Email delivery is temporarily unavailable. This is a problem on our side —
              nothing is wrong with <strong>{sentTo}</strong>.
            </p>
            <p className="mt-3 text-sm text-red-700">
              Your link was created and is waiting, so please try again shortly. The
              administrator has been notified automatically.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <p className="font-medium text-emerald-800">{t("check_email_title")}</p>
            <p className="mt-1 text-sm text-emerald-700">
              {t("sent_to")} <strong>{sentTo}</strong>
            </p>
            <p className="mt-3 text-sm text-emerald-700">{t("link_valid")}</p>
            <p className="mt-2 text-xs text-emerald-600">{t("spam_hint")}</p>
          </div>
        )}

        {problem && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {problem}
          </div>
        )}

        <div className="text-center text-sm text-slate-500">
          {cooldown > 0 ? (
            <p>You can send another link in {cooldown}s</p>
          ) : (
            <p>
              {undeliverable ? "Ready to " : "Still nothing? Make sure the address above is right, or "}
              <button
                onClick={() => send(sentTo)}
                disabled={loading}
                className="font-medium text-emerald-600 underline hover:text-emerald-800 disabled:opacity-50"
              >
                {loading ? t("sending") : undeliverable ? "try again" : t("send_again")}
              </button>
            </p>
          )}
          <button
            onClick={() => {
              setSentTo(null);
              setProblem(null);
              setSuggestion(null);
              setCooldownUntil(null);
              setUndeliverable(false);
            }}
            className="mt-3 text-slate-400 underline hover:text-slate-600"
          >
            {t("use_other")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {problem && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {problem}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          {t("email_label")}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setProblem(null);
            setSuggestion(null);
          }}
          placeholder={t("email_placeholder")}
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        {suggestion && (
          <p className="mt-2 text-sm text-amber-700">
            Did you mean{" "}
            <button
              type="button"
              onClick={() => {
                setEmail(suggestion);
                setSuggestion(null);
                send(suggestion);
              }}
              className="font-medium underline"
            >
              {suggestion}
            </button>
            ?{" "}
            <button
              type="button"
              onClick={() => send(validateEmailShape(email).email)}
              className="text-slate-500 underline"
            >
              No, use what I typed
            </button>
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? t("sending") : t("send_link")}
      </button>
    </form>
  );
}

function AuthTabs() {
  const [tab, setTab] = useState("magic");
  const { t } = useT();
  return (
    <div className="space-y-3">
      <div className="flex bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setTab("magic")}
          className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
            tab === "magic" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          {t("login_magic_tab")}
        </button>
        <button
          onClick={() => setTab("password")}
          className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
            tab === "password" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          {t("login_password_tab")}
        </button>
      </div>
      {tab === "magic" ? <SignInForm /> : <PasswordAuthForm />}
    </div>
  );
}

function PasswordAuthForm() {
  const router = useRouter();
  const { t } = useT();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const check = validateEmailShape(email);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const url = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body = mode === "signup"
        ? { email: check.email, password, displayName: displayName.trim() || null }
        : { email: check.email, password };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.push("/circle");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError(`Too many attempts. Wait ${data.retryAfter || 60}s and try again.`);
      } else if (data.error === "account_exists") {
        setError(t("account_exists"));
      } else if (data.error === "invalid_credentials") {
        setError(t("invalid_credentials"));
      } else if (data.detail) {
        setError(data.detail);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {t("email_label")}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("email_placeholder")}
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {t("password_label")}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password_placeholder")}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          maxLength={200}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {mode === "signup" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Display name (optional)
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={50}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? (mode === "signup" ? t("creating_account") : t("logging_in"))
          : (mode === "signup" ? t("create_account") : t("log_in"))}
      </button>

      <p className="text-center text-xs text-slate-500">
        {mode === "login" ? t("no_account") : t("have_account")}{" "}
        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
          className="font-medium text-emerald-600 underline hover:text-emerald-800"
        >
          {mode === "login" ? t("sign_up") : t("log_in")}
        </button>
      </p>
    </form>
  );
}

function LanguagePicker() {
  const { locale, setLocale, languages } = useT();
  return (
    <div className="flex items-center justify-center gap-1 mb-4">
      {languages.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code)}
          className={`text-xs px-2.5 py-1 rounded-full border ${
            locale === l.code
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-white text-slate-500 border-gray-200"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <LanguagePicker />
        <HomeContent />
      </div>
    </div>
  );
}

function HomeContent() {
  const { t, locale } = useT();
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Leeway</h1>
        <p className="text-slate-500">{t("tagline")}</p>
        <p className="mt-4 text-sm text-slate-500">{t("sign_in_hint")}</p>
      </div>

      <Suspense fallback={null}>
        <ErrorBanner />
      </Suspense>

      <AuthTabs />

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        {t("china_notice")}
      </div>

      <p className="mt-6 text-center text-sm text-slate-400">
        <Link href="/about" className="underline hover:text-slate-600">
          {t("what_is")}
        </Link>
      </p>

      <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-emerald-800 text-center">
          {t("install_title")}
        </p>
        <div className="text-xs text-emerald-700 space-y-1.5">
          <p className="font-medium">{t("install_iphone")}</p>
          <ol className="list-decimal list-inside space-y-0.5 pl-1 text-emerald-600">
            {locale === "zh-CN" ? (
              <>
                <li>点击 Safari 底部左侧的 <strong>☰</strong> 菜单按钮</li>
                <li>点击 <strong>分享</strong> 按钮 <span className="inline-flex items-center"><svg className="w-4 h-4 inline mx-0.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg></span>（带向上箭头的方形图标）</li>
                <li>向下滑动，点击 <strong>添加到主屏幕</strong></li>
                <li>点击右上角的 <strong>添加</strong></li>
              </>
            ) : (
              <>
                <li>Tap the <strong>☰</strong> menu button at the bottom left of Safari</li>
                <li>Tap the <strong>Share</strong> button <span className="inline-flex items-center"><svg className="w-4 h-4 inline mx-0.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg></span> (square with arrow pointing up)</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                <li>Tap <strong>Add</strong> in the top right</li>
              </>
            )}
          </ol>
          <p className="font-medium pt-1">{t("install_android")}</p>
          <ol className="list-decimal list-inside space-y-0.5 pl-1 text-emerald-600">
            {locale === "zh-CN" ? (
              <>
                <li>点击右上角的 <strong>&#8942;</strong> 菜单（三个点）</li>
                <li>点击 <strong>添加到主屏幕</strong></li>
                <li>点击 <strong>添加</strong></li>
              </>
            ) : (
              <>
                <li>Tap the <strong>&#8942;</strong> menu (three dots) at the top right</li>
                <li>Tap <strong>Add to Home screen</strong></li>
                <li>Tap <strong>Add</strong></li>
              </>
            )}
          </ol>
        </div>
      </div>
    </>
  );
}
