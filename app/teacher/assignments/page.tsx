"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Subject { id: string; name: string; }
interface Student { id: string; name: string; email: string; }
interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  subject: { id: string; name: string };
  submission_stats: { total: number; submitted: number; pending: number };
}

export default function TeacherAssignments() {
  const { user, loading: authLoading } = useAuth("teacher");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/teacher/assignments").then((r) => r.json()),
      fetch("/api/subjects").then((r) => r.json()),
      fetch("/api/teacher/students").then((r) => r.json()),
    ]).then(([a, s, st]) => {
      setAssignments(Array.isArray(a) ? a : []);
      setSubjects(Array.isArray(s) ? s : []);
      setStudents(Array.isArray(st) ? st : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  function toggleStudent(id: string) {
    setSelectedStudents((current) => current.includes(id) ? current.filter((studentId) => studentId !== id) : [...current, id]);
  }

  async function createAssignment(event: React.FormEvent) {
    event.preventDefault();
    setCreateError("");
    if (!title.trim() || !subjectId || selectedStudents.length === 0) {
      setCreateError("Subject, title, and at least one student are required");
      return;
    }
    setCreating(true);
    try {
      const response = await fetch("/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_id: subjectId, title: title.trim(), description: description.trim() || undefined, due_date: dueDate || undefined, student_ids: selectedStudents }),
      });
      const data = await response.json();
      if (!response.ok) { setCreateError(data.error ?? "Failed to create assignment"); return; }
      setAssignments((current) => [{ ...data, submission_stats: { total: selectedStudents.length, submitted: 0, pending: selectedStudents.length } }, ...current]);
      setOpen(false);
      setTitle(""); setDescription(""); setSubjectId(""); setDueDate(""); setSelectedStudents([]);
    } catch { setCreateError("Network error. Please try again."); }
    finally { setCreating(false); }
  }

  async function deleteAssignment(assignmentId: string) {
    if (!window.confirm("Delete this assignment and its submissions?")) return;
    setDeleteError("");
    try {
      const response = await fetch(`/api/teacher/assignments/${assignmentId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) { setDeleteError(data.error ?? "Failed to delete assignment"); return; }
      setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
    } catch {
      setDeleteError("Network error. Please try again.");
    }
  }

  if (authLoading || !user) return null;

  return (
    <div className="flex flex-col w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">Assignments</h1>
          <p className="text-[14px] text-on-surface-variant">Create coursework and track student submissions</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 bg-ag-primary text-ag-on-primary text-[13px] font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-[18px]">add</span>Create Assignment
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-outline text-[14px]"><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Loading…</div>
      ) : (
        <div className="bg-surface-container-low rounded-lg overflow-hidden">
          {deleteError && <p className="px-4 py-3 text-[13px] text-ag-error">{deleteError}</p>}
          <div className="overflow-x-auto"><table className="w-full text-left border-collapse">
            <thead><tr className="bg-surface-container-lowest text-outline text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4 font-medium">Assignment</th><th className="py-3 px-4 font-medium">Due Date</th><th className="py-3 px-4 font-medium">Progress</th><th className="py-3 px-4 font-medium text-right">Action</th>
            </tr></thead>
            <tbody>{assignments.length === 0 ? (
              <tr><td colSpan={4} className="py-12 text-center text-[14px] text-outline">No assignments yet. Create your first assignment.</td></tr>
            ) : assignments.map((assignment) => {
              const stats = assignment.submission_stats;
              const percentage = stats.total ? Math.round(stats.submitted / stats.total * 100) : 0;
              return <tr key={assignment.id} className="border-t border-surface-container-lowest hover:bg-surface-container/50 transition-colors">
                <td className="py-4 px-4"><div className="space-y-1"><span className="px-2 py-0.5 rounded bg-surface-container-highest text-ag-secondary text-[11px] uppercase tracking-wider">{assignment.subject.name}</span><div className="text-[15px] font-medium text-on-surface">{assignment.title}</div>{assignment.description && <div className="text-[12px] text-on-surface-variant line-clamp-1">{assignment.description}</div>}</div></td>
                <td className="py-4 px-4 text-[13px] text-on-surface-variant">{assignment.due_date ? new Date(assignment.due_date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "No due date"}</td>
                <td className="py-4 px-4 min-w-52"><div className="flex items-center justify-between text-[13px] mb-1"><span className="text-on-surface">{stats.submitted} / {stats.total} submitted</span><span className="text-outline">{percentage}%</span></div><div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden"><div className="h-full bg-ag-primary rounded-full" style={{ width: `${percentage}%` }} /></div></td>
                <td className="py-4 px-4 text-right"><div className="inline-flex items-center gap-2"><Link href={`/teacher/assignments/${assignment.id}/submissions`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-bright text-[13px] text-on-surface">View Submissions<span className="material-symbols-outlined text-[15px]">chevron_right</span></Link><button type="button" onClick={() => deleteAssignment(assignment.id)} title="Delete assignment" className="p-1.5 rounded text-outline hover:bg-ag-error-container/20 hover:text-ag-error transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button></div></td>
              </tr>;
            })}</tbody>
          </table></div>
          <div className="px-4 py-3 bg-surface-container-lowest text-[13px] text-outline">Showing {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}</div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="bg-surface-container border-outline-variant/30 text-on-surface max-w-xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader><DialogTitle className="text-[20px] font-semibold text-on-surface">Create New Assignment</DialogTitle><p className="text-[13px] text-on-surface-variant">Assign coursework to your students</p></DialogHeader>
        <form onSubmit={createAssignment} className="space-y-4 pt-3">
          <div className="space-y-1.5"><label className="text-[11px] uppercase tracking-wider text-outline font-medium">Subject</label><select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required className="w-full h-10 bg-surface-container-lowest rounded-lg px-3 text-[14px] text-on-surface border border-outline-variant/30"><option value="">Select subject…</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-[11px] uppercase tracking-wider text-outline font-medium">Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full h-10 bg-surface-container-lowest rounded-lg px-3 text-[14px] text-on-surface border border-outline-variant/30" /></div>
          <div className="space-y-1.5"><label className="text-[11px] uppercase tracking-wider text-outline font-medium">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-surface-container-lowest rounded-lg px-3 py-2 text-[14px] text-on-surface border border-outline-variant/30 resize-none" /></div>
          <div className="space-y-1.5"><label className="text-[11px] uppercase tracking-wider text-outline font-medium">Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full h-10 bg-surface-container-lowest rounded-lg px-3 text-[14px] text-on-surface border border-outline-variant/30" /></div>
          <div className="space-y-2"><label className="text-[11px] uppercase tracking-wider text-outline font-medium">Students</label><div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/30">{students.map((student) => <label key={student.id} className="flex items-center gap-2 p-2 rounded hover:bg-surface-container text-[13px] text-on-surface"><input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => toggleStudent(student.id)} />{student.name}<span className="text-outline">{student.email}</span></label>)}</div></div>
          {createError && <p className="text-[13px] text-ag-error">{createError}</p>}
          <button type="submit" disabled={creating} className="w-full h-10 rounded-lg bg-ag-primary text-ag-on-primary text-[14px] font-medium disabled:opacity-50">{creating ? "Creating…" : "Create Assignment"}</button>
        </form>
      </DialogContent></Dialog>
    </div>
  );
}