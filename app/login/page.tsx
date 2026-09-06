"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { safeReturnPath } from "@/lib/auth/redirects";

type Role = "student" | "teacher";
type SessionUserWithRole = {
  role?: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        setError(authError.message || "Login failed");
        return;
      }

      const session = await authClient.getSession();
      if (!session.data?.user) {
        setError("Failed to fetch session");
        return;
      }

      const userRole = (session.data.user as SessionUserWithRole).role as Role;
      const params = new URLSearchParams(window.location.search);
      router.push(safeReturnPath(params.get("next"), userRole));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-surface p-6">
      <div className="w-full max-w-[360px] flex flex-col items-center">

        {/* Brand logo (minimal) */}
        <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-outline-variant/30">
          <span className="material-symbols-outlined text-on-surface text-[22px]">all_inclusive</span>
        </div>

        <h1 className="text-[20px] font-medium text-on-surface tracking-tight mb-8">Sign in to Agora Academic</h1>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full h-[48px] bg-transparent border-b border-outline-variant/50 px-2 text-on-surface placeholder:text-outline text-[15px] focus:outline-none focus:border-on-surface transition-colors rounded-none"
            />
          </div>

          <div className="flex flex-col gap-2 relative">
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full h-[48px] bg-transparent border-b border-outline-variant/50 px-2 text-on-surface placeholder:text-outline text-[15px] focus:outline-none focus:border-on-surface transition-colors rounded-none"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-[12px] text-outline hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showPw ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>

          {error && (
            <p className="text-[13px] text-ag-tertiary mt-2 px-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[48px] mt-6 bg-on-surface text-surface text-[15px] font-medium rounded-full hover:bg-on-surface/90 transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {loading ? (
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            ) : (
              "Continue"
            )}
          </button>
        </form>

        <p className="mt-8 text-[13px] text-on-surface-variant">
          New here?{" "}
          <Link href="/signup" className="text-on-surface hover:underline transition-all">
            Create an account
          </Link>
        </p>

      </div>
    </main>
  );
}
