"use client";

import { useAuth } from "@/hooks/useAuth";
import { StudentSidebar } from "@/components/StudentSidebar";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/student/dashboard": "Dashboard",
  "/student/meetings": "Classes & Meetings",
  "/student/assignments": "Assignments",
  "/student/weak-points": "Weak Points",
  "/student/connect": "Connect with Teacher",
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth("student");
  const pathname = usePathname();

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
        <span className="material-symbols-outlined text-[32px] text-outline animate-spin">progress_activity</span>
      </div>
    );
  }

  const title = Object.entries(pageTitles).find(([k]) => pathname.startsWith(k))?.[1] ?? "Student Portal";

  return (
    <div className="min-h-screen bg-[#111319]">
      <StudentSidebar userName={user.name} />
      <div className="pl-64">
        <header className="fixed top-0 left-64 right-0 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 z-40 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant/30 text-[11px] uppercase tracking-wider">
              Academic Year 2024-25
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border-l border-outline-variant/30 pl-4">
              <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-[13px] font-medium text-on-surface">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[14px] text-on-surface hidden sm:block">{user.name}</span>
            </div>
          </div>
        </header>
        <main className="relative pt-16 bg-[#111319] min-h-screen w-full px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
