"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/me");
  }, [router]);

  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  );
}
