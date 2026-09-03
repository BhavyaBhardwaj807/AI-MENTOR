"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher";
}

type UseAuthResult =
  | { user: AuthUser; loading: false }
  | { user: null; loading: true }
  | { user: null; loading: false };

/**
 * Client-side auth hook. Calls /api/auth/me (HTTP-only cookie, no JWT parsing).
 * - If unauthenticated → redirects to /login
 * - If requiredRole is set and role doesn't match → redirects to the correct dashboard
 */
export function useAuth(requiredRole?: "student" | "teacher"): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("unauthenticated");
        return r.json() as Promise<{ user: AuthUser }>;
      })
      .then(({ user: u }) => {
        if (cancelled) return;
        if (requiredRole && u.role !== requiredRole) {
          router.replace(u.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
          return;
        }
        setUser(u);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [requiredRole, router]);

  if (loading) return { user: null, loading: true };
  return { user, loading: false } as UseAuthResult;
}
