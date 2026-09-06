"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface StudentClassDetail {
  id: string;
  name: string;
  subject: string;
  agentName?: string | null;
  teacherName?: string | null;
}

export default function StudentClassPage(props: { params: Promise<{ classId: string }> }) {
  const params = use(props.params);
  const { user, loading: authLoading } = useAuth("student");

  const [classData, setClassData] = useState<StudentClassDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    fetch(`/api/classes/${params.classId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load class");
        return data;
      })
      .then(data => {
        setClassData(data);
      })
      .catch((err) => {
        console.error(err);
        setClassData(null);
      })
      .finally(() => setLoading(false));
  }, [user, params.classId]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center p-20 text-outline text-[14px]">
        <span className="material-symbols-outlined text-[24px] animate-spin mr-2">progress_activity</span>
        Loading class details...
      </div>
    );
  }

  if (!classData) return <div className="p-8 text-center text-ag-error">Class not found</div>;

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto py-6">
      {/* Header with Breadcrumb */}
      <div className="flex flex-col gap-4 pb-6">
        <Link href="/student/dashboard" className="text-[13px] text-outline hover:text-on-surface flex items-center gap-1 transition-colors w-fit">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-surface-container-high text-on-surface-variant text-[11px] font-medium uppercase tracking-wider rounded">
                {classData.subject}
              </span>
              <span className="text-[12px] text-outline">&bull;</span>
              <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">person</span>
                {classData.teacherName}
              </span>
            </div>
            <h1 className="text-[28px] font-semibold text-on-surface tracking-tight">
              {classData.name}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
        {/* Left Column: AI Mentor */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <section className="bg-gradient-to-br from-ag-primary/10 to-transparent p-6 rounded-2xl border border-ag-primary/20 shadow-sm flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-ag-primary text-ag-on-primary rounded-xl flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-[24px]">smart_toy</span>
              </div>
              <div className="flex flex-col">
                <h2 className="text-[18px] font-semibold text-on-surface">Meet {classData.agentName}</h2>
                <p className="text-[13px] text-on-surface-variant">Your personal AI Mentor for {classData.subject}</p>
              </div>
            </div>

            <p className="text-[14px] text-on-surface leading-relaxed">
              Stuck on a concept? {classData.agentName} has read all the course materials provided by {classData.teacherName} and is ready to help you 1-on-1.
            </p>

            <div className="flex items-center gap-3 mt-2">
              <Link
                href="/student/meetings"
                className="h-11 px-6 bg-ag-primary hover:bg-ag-primary/90 text-ag-on-primary text-[14px] font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                View Meetings
              </Link>
            </div>
          </section>
        </div>

        {/* Right Column: Classwork */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline">assignment</span>
                <h2 className="text-[16px] font-semibold text-on-surface">Classwork</h2>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
              <span className="material-symbols-outlined text-[32px] text-outline mb-2">done_all</span>
              <p className="text-[14px] font-medium text-on-surface">You&apos;re all caught up!</p>
              <p className="text-[12px] text-outline mt-1">No pending assignments for this class.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
