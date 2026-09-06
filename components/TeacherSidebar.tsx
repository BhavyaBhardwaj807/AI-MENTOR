"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  userName: string;
}

const navItems = [
  { path: "/teacher/dashboard", icon: "dashboard", label: "Dashboard" },
  { path: "/teacher/meetings", icon: "video_camera_front", label: "Meetings" },
  { path: "/teacher/assignments", icon: "assignment", label: "Assignments" },
  { path: "/teacher/students", icon: "school", label: "Students" },
  { path: "/teacher/connect", icon: "forum", label: "Messages" },
];

export function TeacherSidebar({ userName }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface z-50 flex flex-col justify-between border-r border-outline-variant/30 select-none">
      <div className="flex flex-col">
        {/* Brand */}
        <div className="h-16 px-4 flex items-center gap-2 border-b border-outline-variant/30">
          <div className="flex flex-col">
            <span className="text-[16px] font-semibold tracking-tight text-on-surface leading-none">Agora</span>
            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider mt-0.5">Teacher Portal</span>
          </div>
        </div>
        <div className="px-4 pt-4 pb-1">
          <span className="text-[11px] uppercase tracking-wider text-outline font-medium">Workspace</span>
        </div>
        <nav className="flex flex-col px-2 gap-0.5">
          {navItems.map((item) => {
            const active = pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                  active
                    ? "bg-surface-container-high text-ag-primary border-l-2 border-ag-primary pl-[14px]"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                )}
              >
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {/* User + logout */}
      <div className="p-2 border-t border-outline-variant/30 bg-surface-container-low">
        <div className="p-2 rounded-lg bg-surface-container flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-[13px] font-medium text-on-surface shrink-0">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] text-on-surface font-medium truncate">{userName}</span>
              <span className="text-[11px] text-on-surface-variant truncate">Teacher</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-1 text-outline hover:text-ag-error transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
