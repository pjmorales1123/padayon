"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DemoWorkspace from "@/features/demo/DemoWorkspace";

const DEMO_USER_ID = "demo-new-student";

function DemoQueryAdapter() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get("userId") || DEMO_USER_ID;
  return <DemoWorkspace initialUserId={userId} />;
}

export default function Demo() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading demo...</div>}>
      <DemoQueryAdapter />
    </Suspense>
  );
}
