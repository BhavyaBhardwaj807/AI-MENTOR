"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface Meeting {
  id: string; title: string; meeting_id: string;
  scheduled_at: string; duration_minutes: number;
  subject: { id: number; name: string };
  teacher: { id: string; name: string };
}
interface Assignment {
  id: string; title: string; description: string | null;
  due_date: string | null; created_at: string; status: "pending" | "submitted";
  submitted_at: string | null; subject: { id: number; name: string };
}

export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuth("student");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/student/meetings").then((r) => r.json()),
      fetch("/api/student/assignments").then((r) => r.json()),
    ])
      .then(([m, a]) => {
        setMeetings(Array.isArray(m) ? m : []);
        setAssignments(Array.isArray(a) ? a : []);
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [user]);

  if (authLoading || !user) return null;

  const pending = assignments.filter((a) => a.status === "pending");
  const submitted = assignments.filter((a) => a.status === "submitted");
  const now = new Date();
  const upcoming = meetings.filter((meeting) => new Date(meeting.scheduled_at).getTime() > now.getTime()).slice(0, 3);

  return (
    <div className="flex flex-col w-full">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-[11px] text-outline uppercase tracking-wider mb-1">
            <span>Student Portal</span><span>/</span>
            <span className="text-on-surface-variant">Dashboard</span>
          </div>
          <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          {!dataLoading && (
            <p className="text-[14px] text-on-surface-variant mt-1">
              {upcoming.length} upcoming session{upcoming.length !== 1 ? "s" : ""} &bull; {pending.length} pending assignment{pending.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {dataLoading ? (
        <div className="flex items-center gap-2 text-outline text-[14px]">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: upcoming sessions */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-lg">calendar_today</span>
                <h2 className="text-[16px] font-medium text-on-surface">Upcoming Sessions</h2>
              </div>
              <Link href="/student/meetings" className="text-[13px] text-ag-primary hover:underline flex items-center gap-0.5">
                View all <span className="material-symbols-outlined text-sm">chevron_right</span>
              </Link>
            </div>

            <div className="bg-surface-container rounded overflow-hidden">
              <div className="bg-surface-container-lowest px-4 py-2 flex items-center justify-between text-outline text-[11px] uppercase tracking-wider">
                <div className="w-2/5">Subject &amp; Teacher</div>
                <div className="w-1/4">Schedule</div>
                <div className="w-1/3 text-right">Action</div>
              </div>
              {upcoming.length === 0 ? (
                <div className="px-4 py-8 text-center text-[14px] text-outline">No upcoming sessions</div>
              ) : (
                upcoming.map((m) => (
                  <div key={m.id} className="px-4 py-3 flex items-center justify-between bg-surface-container hover:bg-surface-bright/20 transition-colors">
                    <div className="w-2/5 min-w-0 pr-3">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-container-high text-ag-primary uppercase">{m.subject.name.slice(0, 4)}</span>
                        <span className="text-[14px] font-medium text-on-surface truncate">{m.title}</span>
                      </div>
                      <p className="text-[12px] text-outline truncate">{m.teacher.name}</p>
                    </div>
                    <div className="w-1/4">
                      <div className="text-[14px] text-on-surface font-medium">
                        {new Date(m.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="text-[11px] text-outline">
                        {new Date(m.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric" })} &bull; {m.duration_minutes}m
                      </div>
                    </div>
                    <div className="w-1/3 flex items-center justify-end">
                      <Link
                        href={`/meeting/${m.meeting_id}`}
                        className="px-3 py-1 bg-inverse-primary hover:bg-ag-primary-container text-ag-on-primary text-[13px] font-medium rounded transition-colors whitespace-nowrap"
                      >
                        Join Class
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: pending tasks + recent submissions */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            {/* Pending */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-lg">pending_actions</span>
                  <h2 className="text-[16px] font-medium text-on-surface">Pending Tasks</h2>
                </div>
                <span className="text-[13px] text-outline">{pending.length} Required</span>
              </div>
              <div className="bg-surface-container rounded overflow-hidden flex flex-col">
                {pending.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[14px] text-outline">No pending assignments</div>
                ) : (
                  pending.slice(0, 3).map((a) => (
                    <div key={a.id} className="p-4 bg-surface-container hover:bg-surface-bright/20 transition-colors flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-outline uppercase">{a.subject.name}</span>
                          {a.due_date && (
                            <>
                              <span className="text-outline text-xs">•</span>
                              <span className="text-[11px] text-ag-tertiary">
                                Due {new Date(a.due_date).toLocaleDateString([], { month: "short", day: "numeric" })}
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-container-lowest text-ag-tertiary">Pending</span>
                      </div>
                      <Link href={`/student/assignments/${a.id}`} className="text-[14px] font-medium text-on-surface hover:text-ag-primary transition-colors">
                        {a.title}
                      </Link>
                      {a.description && <div className="text-[12px] text-outline line-clamp-1">{a.description}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent submissions */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-lg">inventory_2</span>
                  <h3 className="text-[16px] font-medium text-on-surface">Recent Submissions</h3>
                </div>
                <Link href="/student/assignments" className="text-[13px] text-outline hover:text-on-surface">Archive</Link>
              </div>
              <div className="bg-surface-container rounded overflow-hidden flex flex-col">
                {submitted.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[14px] text-outline">No submissions yet</div>
                ) : (
                  submitted.slice(0, 3).map((a) => (
                    <div key={a.id} className="px-4 py-3 bg-surface-container hover:bg-surface-bright/20 transition-colors flex items-center justify-between">
                      <div className="flex flex-col min-w-0 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-outline uppercase">{a.subject.name}</span>
                          {a.submitted_at && (
                            <>
                              <span className="text-outline text-xs">•</span>
                              <span className="text-[11px] text-outline">
                                {new Date(a.submitted_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-[14px] text-on-surface truncate">{a.title}</span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-surface-container-highest text-ag-secondary shrink-0">Submitted</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
