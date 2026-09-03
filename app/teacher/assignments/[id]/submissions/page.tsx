"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface Submission {
  student: { id: string; name: string; email: string };
  status: "submitted" | "pending";
  submitted_at: string | null;
  content: string | null;
  file: { name: string; url: string; type: string } | null;
}

export default function AssignmentSubmissions() {
  const { user, loading: authLoading } = useAuth("teacher");
  const params = useParams<{ id: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !params.id) return;
    fetch(`/api/teacher/assignments/${params.id}/submissions`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to fetch submissions");
        return data;
      })
      .then((data) => setSubmissions(Array.isArray(data) ? data : []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, params.id]);

  if (authLoading || !user) return null;
  const submittedCount = submissions.filter((submission) => submission.status === "submitted").length;

  return (
    <div className="flex flex-col w-full space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/teacher/assignments" className="mt-1 text-outline hover:text-on-surface transition-colors" aria-label="Back to assignments"><span className="material-symbols-outlined">arrow_back</span></Link>
        <div className="space-y-1"><h1 className="text-[24px] font-semibold text-on-surface tracking-tight">Assignment Submissions</h1><p className="text-[14px] text-on-surface-variant">Review student progress and submitted work</p></div>
      </div>

      {loading ? <div className="flex items-center gap-2 text-outline text-[14px]"><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Loading…</div> : error ? <p className="text-[14px] text-ag-error">{error}</p> : (
        <div className="bg-surface-container-low rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-surface-container-lowest text-[13px] text-on-surface-variant">{submittedCount} of {submissions.length} submitted</div>
          <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="bg-surface-container-lowest text-outline text-[11px] uppercase tracking-wider"><th className="py-3 px-4 font-medium">Student</th><th className="py-3 px-4 font-medium">Status</th><th className="py-3 px-4 font-medium">Submitted</th><th className="py-3 px-4 font-medium">Response</th></tr></thead>
            <tbody>{submissions.length === 0 ? <tr><td colSpan={4} className="py-12 text-center text-[14px] text-outline">No students are assigned to this assignment.</td></tr> : submissions.map((submission) => <tr key={submission.student.id} className="border-t border-surface-container-lowest hover:bg-surface-container/50 transition-colors"><td className="py-4 px-4"><div className="text-[14px] font-medium text-on-surface">{submission.student.name}</div><div className="text-[12px] text-on-surface-variant">{submission.student.email}</div></td><td className="py-4 px-4">{submission.status === "submitted" ? <span className="px-2 py-0.5 rounded bg-ag-secondary-container/50 text-ag-secondary text-[13px]">Submitted</span> : <span className="px-2 py-0.5 rounded bg-ag-tertiary-container/30 text-ag-tertiary text-[13px]">Pending</span>}</td><td className="py-4 px-4 text-[13px] text-on-surface-variant">{submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "-"}</td><td className="py-4 px-4 text-[13px] text-on-surface-variant max-w-sm"><span className="line-clamp-2">{submission.content ?? "No response yet"}</span>{submission.file && <div className="mt-1 flex items-center gap-2 text-ag-primary"><span className="material-symbols-outlined text-[15px]">attach_file</span><span className="truncate" title={submission.file.name}>{submission.file.name}</span><a href={submission.file.url} target="_blank" rel="noopener noreferrer" className="shrink-0 hover:underline">{submission.file.type === "application/pdf" ? "View" : "Open"}</a><a href={submission.file.url} download={submission.file.name} className="shrink-0 hover:underline">Download</a></div>}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}