"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface Assignment {
  id: string; title: string; description: string | null;
  due_date: string | null; created_at: string;
  status: "pending" | "submitted"; submitted_at: string | null;
  subject: { id: number; name: string };
}

export default function AssignmentDetail() {
  const { user, loading: authLoading } = useAuth("student");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch("/api/student/assignments")
      .then((r) => r.json())
      .then((list: Assignment[]) => {
        const found = list.find((a) => a.id === id);
        if (!found) { router.replace("/student/assignments"); return; }
        setAssignment(found);
        if (found.status === "submitted") setSubmitted(true);
      })
      .catch(() => router.replace("/student/assignments"))
      .finally(() => setLoading(false));
  }, [user, id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) { setSubmitError("Content is required"); return; }
    setSubmitError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/assignments/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) { setSubmitted(true); return; }
        setSubmitError(data.error ?? "Submission failed");
        return;
      }
      setSubmitted(true);
      setAssignment((prev) => prev ? { ...prev, status: "submitted", submitted_at: data.submitted_at } : prev);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-outline text-[14px] p-8">
        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Loading…
      </div>
    );
  }

  if (!assignment) return null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1400px] mx-auto pb-16">
      {/* Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <nav className="flex items-center gap-2 flex-wrap text-[13px] text-on-surface-variant">
          <Link href="/student/assignments" className="hover:text-ag-primary transition-colors">Assignments</Link>
          <span className="text-outline">/</span>
          <span className="text-on-surface-variant">{assignment.subject.name}</span>
          <span className="text-outline">/</span>
          <span className="text-on-surface font-medium truncate max-w-xs">{assignment.title}</span>
        </nav>
        <Link href="/student/assignments" className="inline-flex items-center gap-1 text-[13px] text-on-surface-variant hover:text-ag-primary transition-colors group self-start">
          <span className="material-symbols-outlined text-base group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
          Back to Assignments
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: assignment details */}
        <section className="lg:col-span-7 flex flex-col gap-8">
          <div className="bg-surface-container rounded-xl p-8 flex flex-col gap-6 shadow-sm">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[13px]">
                  {assignment.subject.name}
                </span>
              </div>
              <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">{assignment.title}</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-lg">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-outline mt-0.5 text-lg">event_available</span>
                <div className="flex flex-col">
                  <span className="text-[11px] text-outline uppercase tracking-wider">Assigned On</span>
                  <span className="text-[14px] text-on-surface">
                    {new Date(assignment.created_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className={`material-symbols-outlined mt-0.5 text-lg ${assignment.due_date ? "text-ag-primary" : "text-outline"}`}>timer</span>
                <div className="flex flex-col">
                  <span className="text-[11px] text-outline uppercase tracking-wider">Deadline</span>
                  <span className={`text-[14px] font-medium ${assignment.due_date ? "text-ag-primary" : "text-outline"}`}>
                    {assignment.due_date
                      ? new Date(assignment.due_date).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })
                      : "No deadline"}
                  </span>
                </div>
              </div>
            </div>

            {assignment.description && (
              <div className="flex flex-col gap-3">
                <h2 className="text-[16px] font-medium text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-ag-primary text-base">notes</span>
                  Instructions &amp; Objective
                </h2>
                <p className="text-[14px] text-on-surface-variant leading-relaxed whitespace-pre-wrap">{assignment.description}</p>
              </div>
            )}
          </div>
        </section>

        {/* Right: submission panel */}
        <section className="lg:col-span-5 flex flex-col gap-6 sticky top-20">
          {submitted ? (
            <div className="bg-surface-container rounded-xl p-8 flex flex-col gap-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                <div className="flex flex-col">
                  <span className="text-[11px] text-outline uppercase tracking-wider">Submission Portal</span>
                  <h3 className="text-[16px] font-medium text-on-surface">Record Verification</h3>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-ag-primary-container/20 text-ag-primary text-[13px]">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  Turned In
                </div>
              </div>
              <div className="p-4 rounded-lg bg-surface-container-low flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-ag-primary/10 text-ag-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[14px] text-on-surface font-medium">Successfully Submitted</span>
                    {assignment.submitted_at && (
                      <p className="text-[13px] text-on-surface-variant leading-relaxed">
                        Submitted on{" "}
                        <span className="text-on-surface font-medium">
                          {new Date(assignment.submitted_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="w-full py-3 px-4 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[16px] font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base text-ag-primary">sync</span>
                Resubmit / Update
              </button>
            </div>
          ) : (
            <div className="bg-surface-container rounded-xl p-8 flex flex-col gap-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                <div className="flex flex-col">
                  <h3 className="text-[16px] font-semibold text-on-surface">Submit Assignment</h3>
                  <p className="text-[12px] text-outline">Write your answer below</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-surface-container-high text-on-surface-variant text-[13px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-ag-tertiary" />
                  Pending
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-on-surface-variant uppercase tracking-wider" htmlFor="submission-content">
                      Your Answer
                    </label>
                    <span className="text-[11px] text-outline">Max 10,000 chars</span>
                  </div>
                  <textarea
                    id="submission-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    maxLength={10000}
                    placeholder="Write your answer or response here…"
                    className="w-full bg-surface-container-low rounded-lg p-3 text-[14px] text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-high transition-colors resize-none border border-outline-variant/30 focus:border-ag-primary"
                  />
                  <div className="text-right text-[11px] text-outline">{content.length} / 10,000</div>
                </div>

                {submitError && (
                  <p className="text-[13px] text-ag-error bg-ag-error-container/20 border border-ag-error/30 rounded-lg px-3 py-2">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !content.trim()}
                  className="w-full py-3 px-4 rounded-lg bg-ag-primary hover:bg-ag-primary-container text-ag-on-primary text-[16px] font-medium transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">send</span>
                      Submit Assignment
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
