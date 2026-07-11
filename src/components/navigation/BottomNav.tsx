"use client";

import { useSearchParams } from "next/navigation";
import AppNavigation from "./AppNavigation";

export default function BottomNav() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("userId") || undefined;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur supports-[padding:max(0px)]:pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-5xl justify-center px-2 py-2">
        <AppNavigation userId={userId} />
      </div>
    </div>
  );
}
