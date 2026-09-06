"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { homeForRole } from "@/lib/auth/redirects";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher" | string;
}

type UseAuthResult =
  | { user: AuthUser; loading: false }
  | { user: null; loading: true }
  | { user: null; loading: false };

/**
 * Client-side auth hook using better-auth client.
 * - If unauthenticated → redirects to /login
 * - If requiredRole is set and role doesn't match → redirects to the correct dashboard
 */
export function useAuth(requiredRole?: "student" | "teacher"): UseAuthResult {
  const router = useRouter();
  const { data, isPending, error } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;

    if (!data?.user || error) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    const u = data.user as unknown as AuthUser;

    if (requiredRole && u.role !== requiredRole) {
      router.replace(homeForRole(u.role));
    }
  }, [data, isPending, error, requiredRole, router]);

  if (isPending) return { user: null, loading: true };
  if (!data?.user) return { user: null, loading: false };

  return { user: data.user as unknown as AuthUser, loading: false };
}
