"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Meeting {
  id: string; title: string; meeting_id: string;
  scheduled_at: string; duration_minutes: number;
  status: "pending" | "live" | "ended";
  subject: { id: string; name: string };
}
interface ClassRecord { id: string; name: string; subject: string; }
interface Student { id: string; name: string; email: string; }

export default function TeacherMeetings() {
  const { user, loading: authLoading } = useAuth("teacher");
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isInstant, setIsInstant] = useState(false);

  // Form state
  const [fTitle, setFTitle] = useState("");
  const [fClass, setFClass] = useState("");
  const [fDate, setFDate] = useState("");
  const [fTime, setFTime] = useState("");
  const [fDuration, setFDuration] = useState("60");
  const [fStudents, setFStudents] = useState<string[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/teacher/meetings").then((r) => r.json()),
      fetch("/api/teacher/classes").then((r) => r.json()),
    ])
      .then(([m, c]) => {
        setMeetings(Array.isArray(m) ? m : []);
        setClasses(Array.isArray(c) ? c : []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [user]);

  // When class changes, fetch its students
  useEffect(() => {
    if (!fClass) return;

    let cancelled = false;
    fetch(`/api/teacher/students?classId=${fClass}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const studentList = Array.isArray(data) ? data : [];
        setStudents(studentList);
        setFStudents(studentList.map(s => s.id)); // Auto-select all by default
      })
      .catch(() => {
        if (!cancelled) setStudents([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStudents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fClass]);

  function handleClassChange(classId: string) {
    setFClass(classId);
    if (!classId) {
      setStudents([]);
      setFStudents([]);
      setLoadingStudents(false);
    } else {
      setLoadingStudents(true);
    }
  }

  function toggleStudent(id: string) {
    setFStudents((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!fTitle.trim() || !fClass) {
      setCreateError("Title and Class are required");
      return;
    }
    if (!isInstant && (!fDate || !fTime)) {
      setCreateError("Date and Time are required for scheduled sessions");
      return;
    }
    if (fStudents.length === 0) {
      setCreateError("Select at least one student");
      return;
    }

    const scheduled_at = isInstant ? new Date().toISOString() : new Date(`${fDate}T${fTime}`).toISOString();
    setCreating(true);
    try {
      const res = await fetch("/api/teacher/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fTitle.trim(),
          classId: fClass,
          scheduled_at,
          duration_minutes: Number(fDuration),
          student_ids: fStudents,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? "Failed to create meeting"); return; }

      setMeetings((prev) => [data, ...prev]);
      setOpen(false);
      setFTitle(""); setFClass(""); setFDate(""); setFTime(""); setFDuration("60"); setFStudents([]); setStudents([]); setLoadingStudents(false);

      if (isInstant) {
        router.push(`/meeting/${data.id}`);
      }
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function cancelMeeting(id: string) {
    if (!window.confirm("Remove this meeting from the schedule?")) return;
    setActionError("");
    const response = await fetch(`/api/teacher/meetings/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) { setActionError(data.error ?? "Failed to remove meeting"); return; }
    setMeetings((prev) => prev.filter((meeting) => meeting.id !== id));
  }

  if (authLoading || !user) return null;

  const now = new Date();
  const upcoming = meetings.filter((m) => m.status === "live" || (m.status !== "ended" && new Date(m.scheduled_at).getTime() > now.getTime()));
  const past = meetings.filter((m) => m.status === "ended" || (m.status !== "live" && new Date(m.scheduled_at).getTime() <= now.getTime()));

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto py-2">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-outline-variant/20">
        <div className="flex flex-col">
          <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">Live Sessions</h1>
          <p className="text-[13px] text-outline mt-1">Schedule and manage virtual classrooms</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="bg-ag-primary hover:bg-ag-primary/90 text-ag-on-primary text-[13px] font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Session
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-outline">
          <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Upcoming Sessions */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[16px] font-medium text-on-surface">Upcoming</h2>
            {upcoming.length === 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-surface-container-highest text-outline flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-[24px]">event_available</span>
                </div>
                <p className="text-[14px] font-medium text-on-surface">No upcoming sessions</p>
                <p className="text-[12px] text-outline mt-1 max-w-xs">Your scheduled virtual classrooms will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map(m => {
                  const date = new Date(m.scheduled_at);
                  const isToday = date.toDateString() === now.toDateString();
                  return (
                    <div key={m.id} className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-5 flex flex-col hover:border-outline-variant transition-colors group">
                      <div className="flex items-start justify-between mb-4">
                        <span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded text-[11px] uppercase tracking-wider font-medium">
                          {m.subject?.name || "Unassigned"}
                        </span>
                        {m.status === "live" ? (
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ag-secondary uppercase tracking-wider bg-ag-secondary-container/20 px-2 py-0.5 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-ag-secondary animate-pulse" /> Live
                          </span>
                        ) : isToday && (
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ag-primary uppercase tracking-wider bg-ag-primary/10 px-2 py-0.5 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-ag-primary animate-pulse" /> Today
                          </span>
                        )}
                      </div>
                      <h3 className="text-[18px] font-semibold text-on-surface leading-tight">{m.title}</h3>
                      <div className="flex items-center gap-4 mt-4 text-[13px] text-on-surface-variant">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                          {date.toLocaleDateString([], { month: "short", day: "numeric" })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">schedule</span>
                          {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
                        <button onClick={() => cancelMeeting(m.id)} className="text-[13px] text-outline hover:text-ag-error transition-colors">
                          Cancel
                        </button>
                        <Link href={`/meeting/${m.id}`} className="bg-surface-container-highest hover:bg-ag-primary hover:text-ag-on-primary text-on-surface px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors">
                          Join Session
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past Sessions */}
          {past.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-[16px] font-medium text-on-surface">Past Sessions</h2>
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden">
                {past.map((m, i) => (
                  <div key={m.id} className={`flex items-center justify-between p-4 ${i !== past.length - 1 ? 'border-b border-outline-variant/20' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-outline">
                        <span className="material-symbols-outlined">history</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[14px] font-medium text-on-surface">{m.title}</span>
                        <span className="text-[12px] text-outline">{m.subject?.name} • {new Date(m.scheduled_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className="text-[12px] text-outline bg-surface-container-high px-2 py-1 rounded">Completed</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {actionError && <p className="mt-4 text-[13px] text-ag-error">{actionError}</p>}

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface-container border border-outline-variant/30 text-on-surface sm:max-w-[500px] p-0 overflow-hidden shadow-2xl rounded-2xl" showCloseButton={false}>
          <div className="px-6 py-5 border-b border-outline-variant/20 flex flex-col gap-4 bg-surface-container-high">
            <div className="flex flex-col gap-1">
              <h2 className="text-[18px] font-semibold text-on-surface">Start Session</h2>
              <p className="text-[13px] text-outline">Create a live virtual classroom</p>
            </div>

            <div className="flex items-center gap-2 p-1 bg-surface-container-lowest rounded-lg w-full">
              <button
                onClick={() => setIsInstant(true)}
                className={`flex-1 py-1.5 text-[13px] font-medium rounded-md transition-colors ${isInstant ? 'bg-ag-primary text-ag-on-primary shadow-sm' : 'text-outline hover:text-on-surface'}`}
              >
                Instant Session
              </button>
              <button
                onClick={() => setIsInstant(false)}
                className={`flex-1 py-1.5 text-[13px] font-medium rounded-md transition-colors ${!isInstant ? 'bg-surface-container-highest text-on-surface shadow-sm' : 'text-outline hover:text-on-surface'}`}
              >
                Schedule for Later
              </button>
            </div>
          </div>

          <form id="create-meeting-form" onSubmit={handleCreate} className="px-6 py-5 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-on-surface-variant">Select Class</label>
              <select
                value={fClass}
                onChange={(e) => handleClassChange(e.target.value)}
                required
                className="h-10 bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 text-[14px] text-on-surface focus:outline-none focus:border-ag-primary"
              >
                <option value="">Choose a class...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-on-surface-variant">Session Title</label>
              <input
                type="text"
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                required
                placeholder="e.g. Chapter 3 Review"
                className="h-10 bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 text-[14px] text-on-surface focus:outline-none focus:border-ag-primary"
              />
            </div>

            {!isInstant && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-on-surface-variant">Date</label>
                  <input
                    type="date"
                    value={fDate}
                    onChange={(e) => setFDate(e.target.value)}
                    required
                    className="h-10 bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 text-[14px] text-on-surface focus:outline-none focus:border-ag-primary"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-on-surface-variant">Time</label>
                  <input
                    type="time"
                    value={fTime}
                    onChange={(e) => setFTime(e.target.value)}
                    required
                    className="h-10 bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 text-[14px] text-on-surface focus:outline-none focus:border-ag-primary"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-medium text-on-surface-variant flex items-center justify-between">
                Invited Students
                {loadingStudents && <span className="text-[11px] text-ag-primary">Loading...</span>}
              </label>

              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-3 max-h-32 overflow-y-auto flex flex-col gap-1">
                {!fClass ? (
                  <p className="text-[12px] text-outline py-2 text-center">Select a class first</p>
                ) : students.length === 0 && !loadingStudents ? (
                  <p className="text-[12px] text-outline py-2 text-center">No students enrolled</p>
                ) : (
                  students.map(s => (
                    <label key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-surface-container p-1 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={fStudents.includes(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="accent-ag-primary w-3.5 h-3.5"
                      />
                      <span className="text-[13px] text-on-surface">{s.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {createError && <p className="text-[13px] text-ag-error">{createError}</p>}
          </form>

          <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface-container-high flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-[13px] font-medium text-outline hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-meeting-form"
              disabled={creating}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50 transition-colors flex items-center gap-1 ${isInstant ? 'bg-ag-secondary hover:bg-ag-secondary/90 text-ag-on-secondary' : 'bg-ag-primary hover:bg-ag-primary/90 text-ag-on-primary'}`}
            >
              {creating ? (isInstant ? "Starting..." : "Scheduling...") : (isInstant ? "Start Session Now" : "Schedule Session")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
