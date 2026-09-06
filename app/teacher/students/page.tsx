"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface Student { id: string; name: string; email: string; }

export default function TeacherStudents() {
  const { user, loading: authLoading } = useAuth("teacher");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch("/api/teacher/students")
      .then((response) => response.json())
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <div className="flex flex-col w-full space-y-6">
      <div className="space-y-1">
        <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">Students</h1>
        <p className="text-[14px] text-on-surface-variant">Students assigned to your classes</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-outline text-[14px]"><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Loading…</div>
      ) : (
        <div className="bg-surface-container-low rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-surface-container-lowest text-outline text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 font-medium">Student</th>
                <th className="py-3 px-4 font-medium">Email</th>
              </tr></thead>
              <tbody>
                {students.length === 0 ? (
                  <tr><td colSpan={2} className="py-12 text-center text-[14px] text-outline">No students assigned to you yet.</td></tr>
                ) : students.map((student) => (
                  <tr key={student.id} className="border-t border-surface-container-lowest hover:bg-surface-container/50 transition-colors">
                    <td className="py-4 px-4"><div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-[12px] font-medium text-on-surface">{student.name.slice(0, 2).toUpperCase()}</div>
                      <span className="text-[14px] font-medium text-on-surface">{student.name}</span>
                    </div></td>
                    <td className="py-4 px-4 text-[13px] text-on-surface-variant">{student.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-surface-container-lowest text-[13px] text-outline">Showing {students.length} student{students.length !== 1 ? "s" : ""}</div>
        </div>
      )}
    </div>
  );
}