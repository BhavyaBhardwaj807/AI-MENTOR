"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "student" | "teacher";
interface Subject { id: number; name: string; }

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
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
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Signup failed"); return; }
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
      <div className="w-full max-w-[460px] bg-surface-container-low border border-outline-variant/40 rounded-xl p-6 sm:p-8 shadow-2xl">

        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[20px] font-semibold text-on-surface tracking-tight">Agora AI Mentor</span>
          </div>
          <h1 className="text-[24px] font-semibold text-on-surface tracking-tight mb-1">Create your account</h1>
          <p className="text-[14px] text-ag-secondary">Join your classroom and get started.</p>
        </div>

        {/* Role selector */}
        <div className="grid grid-cols-2 p-1 bg-surface-container-lowest border border-outline-variant/40 rounded-lg mb-6">
          {(["student", "teacher"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`py-1.5 px-3 text-center text-[13px] font-medium rounded transition-colors ${
                role === r
                  ? "text-white bg-[#6366F1]"
                  : "text-ag-secondary hover:text-on-surface"
              }`}
            >
              {r === "student" ? "Student" : "Teacher"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-[13px] font-medium text-on-surface-variant mb-1.5" htmlFor="fullname">Full Name</label>
            <input
              id="fullname"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === "student" ? "Your full name" : "Dr. Your Name"}
              className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-on-surface placeholder:text-outline text-[14px] focus:outline-none focus:border-[#6366F1] transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[13px] font-medium text-on-surface-variant mb-1.5" htmlFor="email">Institutional Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.edu"
              className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-on-surface placeholder:text-outline text-[14px] focus:outline-none focus:border-[#6366F1] transition-colors"
            />
          </div>

          {/* Subject info (student: informational only; teacher: informational) */}
          {role === "student" && subjects.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-medium text-on-surface-variant">Available Subjects</label>
                <span className="text-[11px] text-ag-secondary">Academic focus</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <span
                    key={s.id}
                    className="px-2.5 py-1 text-[11px] rounded border border-outline-variant/50 bg-surface-container-lowest text-on-surface-variant"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-[13px] font-medium text-on-surface-variant mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password (min 6 chars)"
              className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-on-surface placeholder:text-outline text-[14px] focus:outline-none focus:border-[#6366F1] transition-colors"
            />
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-[13px] font-medium text-on-surface-variant mb-1.5" htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              required
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Re-enter password"
              className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-on-surface placeholder:text-outline text-[14px] focus:outline-none focus:border-[#6366F1] transition-colors"
            />
          </div>

          {error && (
            <p className="text-[13px] text-ag-error bg-ag-error-container/20 border border-ag-error/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#6366F1] hover:bg-[#4F46E5] active:bg-[#4338CA] text-white text-[13px] font-medium rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
            >
              {loading ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              ) : (
                "Create Account"
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-outline-variant/20 text-center">
          <p className="text-[14px] text-ag-secondary">
            Already have an account?{" "}
            <Link href="/login" className="text-ag-primary hover:underline ml-1 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
