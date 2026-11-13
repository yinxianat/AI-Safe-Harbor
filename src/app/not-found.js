import Link from "next/link";

/**
 * Catch-all for URLs that no longer exist.
 *
 * The installed PWA is the reason this page is not just decoration: a home
 * screen shortcut keeps whatever `start_url` the manifest had when it was
 * installed, and the manifest is only re-read on a later visit. A shortcut
 * saved while the manifest pointed at the long-gone `/dashboard` therefore
 * opens straight into a 404, with no navigation on screen to escape it.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">This page moved</h1>
        <p className="text-sm text-slate-500">
          The link you opened is no longer part of Leeway. Everything else is where you left it.
        </p>
        <div className="space-y-2">
          <Link
            href="/circle"
            className="block w-full rounded-xl bg-emerald-600 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Go to my circle
          </Link>
          <Link
            href="/"
            className="block w-full rounded-xl border border-gray-200 bg-white py-3 font-medium text-slate-600"
          >
            Sign in
          </Link>
        </div>
        <p className="text-xs text-slate-400">
          If you opened this from a home screen shortcut, remove it and add Leeway again to pick up
          the new address.
        </p>
      </div>
    </div>
  );
}
