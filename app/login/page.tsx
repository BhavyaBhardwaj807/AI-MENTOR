"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "student" | "teacher";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Login failed"); return; }
      const userRole: Role = data.user.role;
      router.push(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 bg-[radial-gradient(ellipse_at_top,#191b22_0%,#0c0e14_60%)]">
      <div className="w-full max-w-[440px] bg-surface-container-low rounded-xl p-6 sm:p-8 shadow-xl flex flex-col border border-outline-variant/20">

        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex flex-col">
            <span className="text-[16px] font-semibold text-on-surface tracking-tight leading-none">Agora Academic</span>
            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider mt-1">AI Mentorship Environment</span>
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col mb-4">
          <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">Welcome back</h1>
          <p className="text-[14px] text-on-surface-variant mt-1">Sign in to continue to your classroom.</p>
        </div>

        {/* Role selector */}
        <div className="w-full bg-surface-container-lowest p-1 rounded-lg flex items-center mb-6">
          {(["student", "teacher"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-1.5 px-3 rounded-md text-[13px] font-medium transition-all text-center flex items-center justify-center gap-1.5 ${
                role === r
                  ? "bg-ag-primary-container text-ag-on-primary-container"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {r === "student" ? "school" : "cast_for_education"}
              </span>
              {r === "student" ? "Student" : "Teacher"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-on-surface-variant flex justify-between" htmlFor="email">
              <span>Institutional Email</span>
              <span className="text-[11px] text-ag-secondary">
                {role === "student" ? "@school.edu" : "@faculty.edu"}
              </span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={role === "student" ? "student@school.edu" : "instructor@university.edu"}
              className="w-full h-[38px] bg-surface-container-lowest px-3 text-on-surface placeholder:text-outline text-[14px] rounded-lg focus:outline-none focus:bg-surface-container transition-colors border border-outline-variant/30 focus:border-ag-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-on-surface-variant" htmlFor="password">Password</label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-[38px] bg-surface-container-lowest px-3 pr-10 text-on-surface placeholder:text-outline text-[14px] rounded-lg focus:outline-none focus:bg-surface-container transition-colors border border-outline-variant/30 focus:border-ag-primary"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2.5 p-1 text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPw ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-ag-error bg-ag-error-container/20 border border-ag-error/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[40px] mt-1 bg-ag-primary text-ag-on-primary text-[16px] font-medium rounded-lg hover:opacity-90 active:opacity-80 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            ) : (
              <>
                <span>Sign In</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-outline-variant/20 flex flex-col items-center gap-2 text-center">
          <p className="text-[13px] text-on-surface-variant">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[13px] font-medium text-ag-primary hover:underline ml-1">
              Create account
            </Link>
          </p>
          <div className="flex items-center gap-1.5 text-outline">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            <span className="text-[11px] text-outline">FERPA &amp; Institutional Governance Compliant</span>
          </div>
        </div>
      </div>
    </main>
  );
}
