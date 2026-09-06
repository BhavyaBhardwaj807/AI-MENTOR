"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

interface Subject { id: string; name: string; }

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [teacherInviteCode, setTeacherInviteCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/subjects")
      .then((r) => r.json())
      .then((data: Subject[]) => setSubjects(data))
      .catch(() => {});
  }, []);

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

      if (teacherInviteCode.trim()) {
        const inviteResponse = await fetch("/api/auth/teacher-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: teacherInviteCode.trim() }),
        });

        if (!inviteResponse.ok) {
          const data = await inviteResponse.json().catch(() => ({}));
          setError(data.error || "Account created as a student, but teacher invite validation failed.");
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
      <div className="w-full max-w-[360px] flex flex-col items-center">

        {/* Brand logo (minimal) */}
        <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-outline-variant/30">
          <span className="material-symbols-outlined text-on-surface text-[22px]">all_inclusive</span>
        </div>

        <h1 className="text-[20px] font-medium text-on-surface tracking-tight mb-8">Create your account</h1>

        <p className="text-[13px] text-on-surface-variant text-center mb-8">
          Student accounts can join classes with a teacher-provided code. Teachers need an invite code.
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">

          <div className="flex flex-col gap-2">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full h-[48px] bg-transparent border-b border-outline-variant/50 px-2 text-on-surface placeholder:text-outline text-[15px] focus:outline-none focus:border-on-surface transition-colors rounded-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Institutional email"
              className="w-full h-[48px] bg-transparent border-b border-outline-variant/50 px-2 text-on-surface placeholder:text-outline text-[15px] focus:outline-none focus:border-on-surface transition-colors rounded-none"
            />
          </div>

          {/* Subject info (student: informational only) */}
          {subjects.length > 0 && (
            <div className="px-2 pt-2">
              <span className="block text-[11px] text-on-surface-variant mb-2">Available Subjects</span>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <span
                    key={s.id}
                    className="px-2.5 py-1 text-[11px] rounded-full border border-outline-variant/30 text-on-surface-variant"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={teacherInviteCode}
              onChange={(e) => setTeacherInviteCode(e.target.value)}
              placeholder="Teacher invite code (optional)"
              className="w-full h-[48px] bg-transparent border-b border-outline-variant/50 px-2 text-on-surface placeholder:text-outline text-[15px] focus:outline-none focus:border-on-surface transition-colors rounded-none"
            />
          </div>

          <div className="flex flex-col gap-2 relative mt-2">
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

          <div className="flex flex-col gap-2 relative">
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
              "Create Account"
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
