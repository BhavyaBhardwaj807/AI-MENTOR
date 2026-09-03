"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Meeting {
  id: string; title: string; meeting_id: string;
  scheduled_at: string; duration_minutes: number;
  subject: { id: string; name: string };
}
interface Subject { id: string; name: string; }
interface Student { id: string; name: string; email: string; }

export default function TeacherMeetings() {
  const { user, loading: authLoading } = useAuth("teacher");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Form state
  const [fTitle, setFTitle] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fDate, setFDate] = useState("");
  const [fTime, setFTime] = useState("");
  const [fDuration, setFDuration] = useState("45");
  const [fStudents, setFStudents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/teacher/meetings").then((r) => r.json()),
      fetch("/api/subjects").then((r) => r.json()),
      fetch("/api/teacher/students").then((r) => r.json()),
    ])
      .then(([m, s, st]) => {
        setMeetings(Array.isArray(m) ? m : []);
        setSubjects(Array.isArray(s) ? s : []);
        setStudents(Array.isArray(st) ? st : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  function toggleStudent(id: string) {
    setFStudents((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  function selectAll() { setFStudents(students.map((s) => s.id)); }
  function clearAll() { setFStudents([]); }

  async function handleCreate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setCreateError("");
    const dateVal = fDate.trim();
    const timeVal = fTime.trim();
    if (!fTitle.trim()) { setCreateError("Title is required"); return; }
    if (!fSubject) { setCreateError("Subject is required"); return; }
    if (!dateVal || !timeVal) { setCreateError("Date and time are required"); return; }
    if (fStudents.length === 0) { setCreateError("Select at least one student"); return; }

    const scheduled_at = new Date(`${dateVal}T${timeVal}`).toISOString();
    setCreating(true);
    try {
      const res = await fetch("/api/teacher/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fTitle.trim(),
          subject_id: fSubject,
          scheduled_at,
          duration_minutes: Number(fDuration),
          student_ids: fStudents,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? "Failed to create meeting"); return; }
      setMeetings((prev) => [data, ...prev]);
      setOpen(false);
      setFTitle(""); setFSubject(""); setFDate(""); setFTime(""); setFDuration("45"); setFStudents([]);
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  if (authLoading || !user) return null;

  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(m.scheduled_at) >= now);
  const past = meetings.filter((m) => new Date(m.scheduled_at) < now);

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-outline">Pedagogical Schedule</span>
            <span className="text-outline text-[11px]">•</span>
            <span className="text-[13px] text-ag-primary">Live Instruction</span>
          </div>
          <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">Meetings &amp; Classes</h1>
          <p className="text-[14px] text-on-surface-variant">Manage and schedule your classes with assigned students</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 bg-ag-primary text-ag-on-primary text-[13px] font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create Meeting
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Upcoming", value: upcoming.length, icon: "timer" },
          { label: "Total Meetings", value: meetings.length, icon: "calendar_month" },
          { label: "Students", value: students.length, icon: "groups" },
          { label: "Past Sessions", value: past.length, icon: "history_edu" },
        ].map((s) => (
          <div key={s.label} className="bg-surface-container-low p-4 rounded-lg flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] text-outline uppercase tracking-wider">{s.label}</span>
              <div className="text-[20px] font-semibold text-on-surface">{s.value}</div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-ag-primary">
              <span className="material-symbols-outlined text-[20px]">{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-outline text-[14px]">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Loading…
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest text-outline text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 font-medium">Topic &amp; Subject</th>
                  <th className="py-3 px-4 font-medium">Schedule</th>
                  <th className="py-3 px-4 font-medium">Duration</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {meetings.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-[14px] text-outline">No meetings yet. Create your first meeting.</td></tr>
                ) : (
                  meetings.map((m) => {
                    const isUpcoming = new Date(m.scheduled_at) >= now;
                    const isToday = new Date(m.scheduled_at).toDateString() === now.toDateString();
                    return (
                      <tr key={m.id} className="hover:bg-surface-container/50 transition-colors border-t border-surface-container-lowest">
                        <td className="py-4 px-4">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 px-2 py-0.5 rounded bg-surface-container-highest text-ag-secondary text-[13px] font-medium">{m.subject.name}</span>
                            <div className="space-y-0.5">
                              <div className="text-[16px] font-semibold text-on-surface">{m.title}</div>
                              <div className="text-[11px] text-outline font-mono">{m.meeting_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className={`text-[14px] font-medium flex items-center gap-1.5 ${isToday ? "text-on-surface" : "text-on-surface"}`}>
                              {isToday && <span className="w-1.5 h-1.5 rounded-full bg-ag-primary animate-pulse" />}
                              {new Date(m.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric" })}, {new Date(m.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-on-surface-variant text-[13px]">{m.duration_minutes}m</td>
                        <td className="py-4 px-4">
                          {isToday ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-ag-primary/10 text-ag-primary text-[13px] font-medium">
                              <span className="w-1 h-1 rounded-full bg-ag-primary" />Today
                            </span>
                          ) : isUpcoming ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded bg-surface-container-highest text-on-surface-variant text-[13px]">Scheduled</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded bg-surface-container-highest text-outline text-[13px]">Past</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {isUpcoming ? (
                            <Link
                              href={`/meeting/${m.meeting_id}`}
                              className="bg-ag-primary text-ag-on-primary px-3 py-1.5 rounded text-[13px] font-medium hover:opacity-90 transition-opacity"
                            >
                              Start Meeting
                            </Link>
                          ) : (
                            <span className="text-outline text-[13px]">Ended</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-surface-container-lowest flex items-center justify-between">
            <span className="text-[13px] text-outline">Showing {meetings.length} meeting{meetings.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}

      {/* Create Meeting Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface-container border-outline-variant/30 text-on-surface max-w-xl max-h-[90vh] overflow-y-auto p-0" showCloseButton={false}>
          <DialogHeader className="px-6 py-4 bg-surface-container-high border-b border-outline-variant/20">
            <DialogTitle className="text-[20px] font-semibold text-on-surface">Create New Meeting</DialogTitle>
            <p className="text-[13px] text-on-surface-variant">Configure classroom session and target students</p>
          </DialogHeader>

          <form id="create-meeting-form" onSubmit={handleCreate} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-outline font-medium">Subject</label>
              <select
                value={fSubject}
                onChange={(e) => setFSubject(e.target.value)}
                required
                className="w-full h-10 bg-surface-container-lowest rounded-lg px-3 text-[14px] text-on-surface appearance-none focus:outline-none focus:ring-1 focus:ring-ag-primary border border-outline-variant/30"
              >
                <option value="">Select subject…</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-outline font-medium">Meeting Title</label>
              <input
                type="text"
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                required
                placeholder="e.g. Ray Optics Lab Session"
                className="w-full h-10 bg-surface-container-lowest rounded-lg px-3 text-[14px] text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-ag-primary border border-outline-variant/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-outline font-medium">Date</label>
                <input
                  type="date"
                  value={fDate}
                  onChange={(e) => setFDate(e.target.value)}
                  required
                  className="w-full h-10 bg-surface-container-lowest rounded-lg px-3 text-[13px] text-on-surface focus:outline-none focus:ring-1 focus:ring-ag-primary border border-outline-variant/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-outline font-medium">Start Time</label>
                <input
                  type="time"
                  value={fTime}
                  onChange={(e) => setFTime(e.target.value)}
                  required
                  className="w-full h-10 bg-surface-container-lowest rounded-lg px-3 text-[13px] text-on-surface focus:outline-none focus:ring-1 focus:ring-ag-primary border border-outline-variant/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-outline font-medium">Duration (minutes)</label>
              <select
                value={fDuration}
                onChange={(e) => setFDuration(e.target.value)}
                className="w-full h-10 bg-surface-container-lowest rounded-lg px-3 text-[14px] text-on-surface appearance-none focus:outline-none focus:ring-1 focus:ring-ag-primary border border-outline-variant/30"
              >
                {[30, 45, 50, 60, 90].map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wider text-outline font-medium">Select Students</label>
                <div className="flex gap-3">
                  <button type="button" onClick={selectAll} className="text-[13px] text-ag-primary hover:underline">All</button>
                  <button type="button" onClick={clearAll} className="text-[13px] text-outline hover:text-on-surface">Clear</button>
                </div>
              </div>
              <div className="bg-surface-container-lowest rounded-lg p-3 max-h-40 overflow-y-auto flex flex-col gap-1 border border-outline-variant/30">
                {students.length === 0 ? (
                  <p className="text-[13px] text-outline text-center py-2">No students assigned to you yet</p>
                ) : (
                  students.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-surface-container rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={fStudents.includes(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="accent-[#6366F1] w-4 h-4 rounded"
                      />
                      <span className="text-[13px] text-on-surface">{s.name}</span>
                      <span className="text-[11px] text-outline ml-auto">{s.email}</span>
                    </label>
                  ))
                )}
              </div>
              {fStudents.length > 0 && (
                <p className="text-[13px] text-on-surface-variant">{fStudents.length} student{fStudents.length !== 1 ? "s" : ""} selected</p>
              )}
            </div>

            {createError && (
              <p className="text-[13px] text-ag-error bg-ag-error-container/20 border border-ag-error/30 rounded-lg px-3 py-2">{createError}</p>
            )}
          </form>

          <DialogFooter className="px-6 py-4 bg-surface-container-high border-t border-outline-variant/20 flex items-center justify-end gap-3 rounded-b-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg text-[13px] text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-meeting-form"
              disabled={creating}
              className="bg-ag-primary text-ag-on-primary px-4 py-2 rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 flex items-center gap-1"
            >
              {creating ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              ) : (
                <><span className="material-symbols-outlined text-[18px]">add</span>Create Meeting</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
