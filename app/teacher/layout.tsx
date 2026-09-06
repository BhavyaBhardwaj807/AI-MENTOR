"use client";

import { useAuth } from "@/hooks/useAuth";
import { TeacherSidebar } from "@/components/TeacherSidebar";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth("teacher");

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest">
        <span className="material-symbols-outlined text-[32px] text-outline animate-spin">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <TeacherSidebar userName={user.name} />
      <div className="pl-64">
        <header className="fixed top-0 left-64 right-0 h-16 bg-surface/90 backdrop-blur-md z-40 flex items-center justify-between px-6 border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-surface-container px-3 py-1 rounded-lg border border-outline-variant/40">
              <span className="w-1.5 h-1.5 rounded-full bg-ag-primary" />
              <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Academic Year 2024-25</span>
            </div>
          </div>
        </header>
        <main className="relative pt-16 min-h-screen bg-surface-container-lowest">
          <div className="px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
