"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface Assignment {
  id: string; title: string; description: string | null;
  due_date: string | null; created_at: string;
  status: "pending" | "submitted"; submitted_at: string | null;
  subject: { id: number; name: string };
}

export default function StudentAssignments() {
  const { user, loading: authLoading } = useAuth("student");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "submitted">("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    fetch("/api/student/assignments")
      .then((r) => r.json())
      .then((d) => setAssignments(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || !user) return null;

  const subjects = Array.from(new Set(assignments.map((a) => a.subject.name))).sort();

  const filtered = assignments.filter((a) => {
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const matchSubject = subjectFilter === "all" || a.subject.name === subjectFilter;
    return matchStatus && matchSubject;
  });

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">Assignments</h1>
          <p className="text-[14px] text-on-surface-variant mt-1">View assigned coursework and track submission status</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 bg-surface-container-low p-4 rounded shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Subject filter */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
            {["all", ...subjects].map((s) => (
              <button
                key={s}
                onClick={() => setSubjectFilter(s)}
                className={`px-3 py-1.5 rounded text-[13px] transition-colors shrink-0 ${
                  subjectFilter === s
                    ? "bg-surface-bright text-on-surface"
                    : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div className="inline-flex rounded bg-surface-container-lowest p-0.5">
            {(["all", "pending", "submitted"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded text-[13px] transition-colors capitalize ${
                  statusFilter === s
                    ? "bg-surface-container-high text-on-surface font-medium"
                    : "text-outline hover:text-on-surface"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-surface-container-low rounded shadow-sm overflow-hidden flex flex-col">
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-surface-container-lowest text-outline text-[11px] uppercase tracking-wider">
          <div className="col-span-2">Subject</div>
          <div className="col-span-4">Assignment</div>
          <div className="col-span-2">Due Date</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-outline text-[14px] p-8">
            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-[48px] text-outline mb-3">assignment</span>
            <h3 className="text-[16px] font-medium text-on-surface">No assignments found</h3>
            <p className="text-[13px] text-on-surface-variant mt-1">Try changing the filters above.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((a, i) => {
              const isPending = a.status === "pending";
              const rowBg = i % 2 === 0 ? "bg-surface-container" : "bg-surface-container-low";
              return (
                <div
                  key={a.id}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-4 px-4 py-4 ${rowBg} hover:bg-surface-container-high transition-colors items-center`}
                >
                  <div className="md:col-span-2">
                    <span className="px-2 py-0.5 rounded text-[11px] uppercase tracking-wider bg-surface-container-lowest text-on-surface-variant">
                      {a.subject.name}
                    </span>
                  </div>
                  <div className="md:col-span-4 flex flex-col min-w-0 pr-4">
                    <span className="text-[16px] font-medium text-on-surface truncate">{a.title}</span>
                    {a.description && (
                      <span className="text-[12px] text-on-surface-variant line-clamp-1 mt-0.5">{a.description}</span>
                    )}
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    {a.due_date ? (
                      <>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPending ? "bg-ag-tertiary" : "bg-outline"}`} />
                        <div className="flex flex-col">
                          <span className={`text-[13px] font-medium ${isPending ? "text-ag-tertiary" : "text-outline"}`}>
                            {new Date(a.due_date).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-[13px] text-outline">No due date</span>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    {isPending ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-ag-tertiary-container/30 text-ag-tertiary text-[13px] font-medium">Pending</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-ag-secondary-container/50 text-ag-secondary text-[13px]">Submitted</span>
                    )}
                  </div>
                  <div className="md:col-span-2 flex justify-start md:justify-end mt-2 md:mt-0">
                    <Link
                      href={`/student/assignments/${a.id}`}
                      className={`px-3 py-1.5 rounded text-[13px] font-medium whitespace-nowrap transition-colors ${
                        isPending
                          ? "bg-ag-primary text-ag-on-primary hover:opacity-90"
                          : "bg-surface-container-highest hover:bg-surface-bright text-on-surface"
                      }`}
                    >
                      {isPending ? "Open" : "View"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 bg-surface-container-lowest text-outline text-[13px]">
          <span className="text-on-surface-variant">Showing {filtered.length} of {assignments.length} assignments</span>
        </div>
      </div>
    </div>
  );
}
