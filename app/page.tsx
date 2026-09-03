"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(({ user }) => {
        router.replace(user.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
      <span className="material-symbols-outlined text-[32px] text-outline animate-spin">progress_activity</span>
    </div>
  );
}
