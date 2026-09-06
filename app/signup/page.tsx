"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

type Role = "student" | "teacher";

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPw) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const { error: authError } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        setError(authError.message || "Signup failed");
        return;
      }

      // If teacher, upgrade the role
      if (role === "teacher") {
        const res = await fetch("/api/auth/teacher-invite", { method: "POST" });
        if (!res.ok) {
          setError("Account created but failed to set teacher role. Contact support.");
          return;
        }
        router.push("/teacher/dashboard");
        return;
      }

      router.push("/student/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-surface p-6">
      <div className="w-full max-w-[400px] flex flex-col items-center">

        {/* Brand logo */}
        <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-outline-variant/30">
          <span className="material-symbols-outlined text-on-surface text-[22px]">all_inclusive</span>
        </div>

        <h1 className="text-[20px] font-medium text-on-surface tracking-tight mb-6">Create your account</h1>

        {/* Role selector */}
        <div className="w-full flex rounded-[12px] border border-outline-variant/40 overflow-hidden mb-6">
          <button
            type="button"
            onClick={() => { setRole("student"); setError(""); }}
            className={`flex-1 py-3 text-[14px] font-medium transition-colors flex items-center justify-center gap-2 ${
              role === "student"
                ? "bg-ag-primary text-on-surface"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">school</span>
            Student
          </button>
          <button
            type="button"
            onClick={() => { setRole("teacher"); setError(""); }}
            className={`flex-1 py-3 text-[14px] font-medium transition-colors flex items-center justify-center gap-2 border-l border-outline-variant/40 ${
              role === "teacher"
                ? "bg-ag-primary text-on-surface"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            Teacher
          </button>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full h-[48px] bg-transparent border-b border-outline-variant/50 px-2 text-on-surface placeholder:text-outline text-[15px] focus:outline-none focus:border-on-surface transition-colors rounded-none"
          />

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full h-[48px] bg-transparent border-b border-outline-variant/50 px-2 text-on-surface placeholder:text-outline text-[15px] focus:outline-none focus:border-on-surface transition-colors rounded-none"
          />

          <div className="relative mt-2">
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 chars)"
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

          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Confirm password"
              className="w-full h-[48px] bg-transparent border-b border-outline-variant/50 px-2 text-on-surface placeholder:text-outline text-[15px] focus:outline-none focus:border-on-surface transition-colors rounded-none"
            />
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
              `Create ${role === "teacher" ? "Teacher" : "Student"} Account`
            )}
          </button>
        </form>

        <p className="mt-8 text-[13px] text-on-surface-variant">
          Already have an account?{" "}
          <Link href="/login" className="text-on-surface hover:underline transition-all">
            Sign in
          </Link>
        </p>

      </div>
    </main>
  );
}
