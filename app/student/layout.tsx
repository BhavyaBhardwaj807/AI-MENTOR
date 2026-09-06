"use client";

import { useAuth } from "@/hooks/useAuth";
import { StudentSidebar } from "@/components/StudentSidebar";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth("student");

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
        <span className="material-symbols-outlined text-[32px] text-outline animate-spin">progress_activity</span>
      </div>
    );
  }

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
        </header>
        <main className="relative pt-16 bg-[#111319] min-h-screen w-full px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
