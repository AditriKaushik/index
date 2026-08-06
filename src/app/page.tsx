"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/chat" : "/login");
  }, [loading, user, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <p className="text-sm text-muted">Loading…</p>
    </main>
  );
}
