"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/client";

interface Props {
  userName: string;
}

const navItems = [
  { path: "/student/dashboard", icon: "dashboard", label: "Dashboard" },
  { path: "/student/meetings", icon: "videocam", label: "Meetings" },
  { path: "/student/assignments", icon: "assignment", label: "Assignments" },
  { path: "/student/weak-points", icon: "track_changes", label: "Weak Points" },
  { path: "/student/connect", icon: "forum", label: "Connect with Teacher" },
];

export function StudentSidebar({ userName }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-container-low border-r border-outline-variant/30 z-50 flex flex-col justify-between select-none">
      <div className="flex flex-col">
        {/* Brand */}
        <div className="h-16 flex items-center px-4 gap-3 border-b border-outline-variant/20">
          <div className="flex flex-col">
            <span className="text-[16px] font-semibold tracking-tight text-on-surface leading-tight">Agora</span>
            <span className="text-[11px] text-outline tracking-normal uppercase">Student Portal</span>
          </div>
        </div>
        {/* Nav */}
        <div className="px-2 pt-4">
          <p className="px-2 mb-1 text-[11px] uppercase text-outline tracking-wider">Workspace</p>
          <nav className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const active = pathname === item.path || pathname.startsWith(item.path + "/");
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-1.5 rounded text-[14px] transition-colors",
                    active
                      ? "bg-surface-container-high text-on-surface font-medium border-l-2 border-ag-primary"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  )}
                >
                  <span className="material-symbols-outlined text-[18px] text-outline">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {/* User + logout */}
      <div className="p-2 border-t border-outline-variant/20 bg-surface-container-lowest/50">
        <div className="flex items-center gap-3 p-2 rounded bg-surface-container/60 mb-1 border border-outline-variant/20">
          <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-[13px] font-medium text-on-surface shrink-0">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[14px] text-on-surface font-medium truncate leading-snug">{userName}</span>
            <span className="text-[11px] text-outline truncate">Student</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full py-1.5 px-3 rounded text-[13px] text-ag-error hover:bg-surface-container-high hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Log out
        </button>
      </div>
    </aside>
  );
}
