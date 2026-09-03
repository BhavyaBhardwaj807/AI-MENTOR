"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface Meeting {
  id: string; title: string; meeting_id: string;
  scheduled_at: string; duration_minutes: number;
  subject: { id: number; name: string };
}
interface Assignment {
  id: string; title: string; due_date: string | null;
  subject: { id: number; name: string };
  submission_stats: { total: number; submitted: number; pending: number };
}
interface Student { id: string; name: string; email: string; }

export default function TeacherDashboard() {
  const { user, loading: authLoading } = useAuth("teacher");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/teacher/meetings").then((r) => r.json()),
      fetch("/api/teacher/assignments").then((r) => r.json()),
      fetch("/api/teacher/students").then((r) => r.json()),
    ])
      .then(([m, a, s]) => {
        setMeetings(Array.isArray(m) ? m : []);
        setAssignments(Array.isArray(a) ? a : []);
        setStudents(Array.isArray(s) ? s : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || !user) return null;

  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(m.scheduled_at).getTime() > now.getTime());
  const totalPending = assignments.reduce((sum, a) => sum + a.submission_stats.pending, 0);

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-1">
        <div className="flex flex-col">
          <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">Teacher Dashboard</h1>
          <p className="text-[13px] text-on-surface-variant mt-0.5">Overview for {user.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-outline">calendar_today</span>
          <span className="text-[13px] text-on-surface-variant font-medium">
            {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-outline text-[14px]">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Loading…
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Students", value: students.length, icon: "group", sub: "Assigned to you" },
              { label: "Upcoming Meetings", value: upcoming.length, icon: "videocam", sub: `${upcoming.filter(m => new Date(m.scheduled_at).toDateString() === now.toDateString()).length} today` },
              { label: "Active Assignments", value: assignments.length, icon: "assignment_turned_in", sub: "Across all subjects" },
              { label: "Pending Submissions", value: totalPending, icon: "pending_actions", sub: "Awaiting review", accent: true },
            ].map((metric) => (
              <div key={metric.label} className="bg-surface-container-low p-4 rounded-lg flex flex-col justify-between">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="text-[11px] uppercase tracking-wider font-medium">{metric.label}</span>
                  <span className="material-symbols-outlined text-[18px] text-outline">{metric.icon}</span>
                </div>
                <div className="mt-3 flex flex-col">
                  <span className={`text-[36px] font-semibold leading-none ${metric.accent ? "text-ag-tertiary" : "text-on-surface"}`}>
                    {metric.value}
                  </span>
                  <span className="text-[11px] text-on-surface-variant mt-1.5">{metric.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Two-column */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Upcoming meetings */}
            <section className="lg:col-span-7 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-on-surface tracking-tight">Upcoming Meetings</h2>
                  <span className="px-1 py-0.5 rounded bg-surface-container text-on-surface-variant text-[13px] font-medium">{upcoming.length}</span>
                </div>
                <Link href="/teacher/meetings" className="text-[13px] text-ag-primary hover:underline flex items-center gap-0.5">
                  View all <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {upcoming.length === 0 ? (
                  <div className="bg-surface-container-low p-8 rounded-lg text-center text-[14px] text-outline">No upcoming meetings</div>
                ) : (
                  upcoming.slice(0, 3).map((m) => {
                    const isToday = new Date(m.scheduled_at).toDateString() === now.toDateString();
                    return (
                      <div key={m.id} className="bg-surface-container-low p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-container transition-colors">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-1 py-0.5 rounded bg-surface-container-highest text-[11px] text-on-surface-variant font-medium uppercase tracking-wider">{m.subject.name}</span>
                            <span className={`flex items-center gap-1 text-[13px] font-medium ${isToday ? "text-ag-primary" : "text-on-surface-variant"}`}>
                              {isToday && <span className="w-1.5 h-1.5 rounded-full bg-ag-primary animate-pulse" />}
                              {new Date(m.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric" })}, {new Date(m.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &bull; {m.duration_minutes}m
                            </span>
                          </div>
                          <h3 className="text-[16px] font-medium text-on-surface truncate mt-0.5">{m.title}</h3>
                        </div>
                        <div className="shrink-0">
                          <Link
                            href={`/meeting/${m.meeting_id}`}
                            className={`h-9 px-4 rounded font-medium text-[13px] flex items-center gap-1 transition-colors ${
                              isToday
                                ? "bg-inverse-primary hover:bg-ag-primary-container text-ag-on-primary"
                                : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                            }`}
                          >
                            {isToday ? (
                              <><span className="material-symbols-outlined text-[18px]">play_circle</span>Start Meeting</>
                            ) : (
                              <><span className="material-symbols-outlined text-[18px] text-outline">tune</span>Manage</>
                            )}
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Active assignments */}
            <section className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-on-surface tracking-tight">Active Assignments</h2>
                  <span className="px-1 py-0.5 rounded bg-surface-container text-on-surface-variant text-[13px] font-medium">{assignments.length}</span>
                </div>
                <Link href="/teacher/assignments" className="text-[13px] text-ag-primary hover:underline flex items-center gap-0.5">
                  View all <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {assignments.length === 0 ? (
                  <div className="bg-surface-container-low p-8 rounded-lg text-center text-[14px] text-outline">No assignments yet</div>
                ) : (
                  assignments.slice(0, 3).map((a) => {
                    const pct = a.submission_stats.total > 0
                      ? Math.round((a.submission_stats.submitted / a.submission_stats.total) * 100)
                      : 0;
                    return (
                      <div key={a.id} className="bg-surface-container-low p-4 rounded-lg flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">{a.subject.name}</span>
                            {a.due_date && (
                              <span className="text-[11px] text-on-surface-variant">
                                Due {new Date(a.due_date).toLocaleDateString([], { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                          <h3 className="text-[16px] font-medium text-on-surface mt-0.5">{a.title}</h3>
                        </div>
                        <div className="flex flex-col gap-1.5 pt-1">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-on-surface font-medium">
                              {a.submission_stats.submitted} / {a.submission_stats.total} Submitted
                              <span className="text-on-surface-variant font-normal ml-1">({pct}%)</span>
                            </span>
                            <span className={a.submission_stats.pending > 0 ? "text-ag-tertiary font-medium" : "text-on-surface-variant"}>
                              {a.submission_stats.pending} Pending
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-ag-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center justify-end pt-1">
                          <Link
                            href={`/teacher/assignments/${a.id}/submissions`}
                            className="h-8 px-3 bg-surface-container hover:bg-surface-container-high text-on-surface text-[13px] rounded flex items-center gap-1 transition-colors"
                          >
                            View Submissions <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
