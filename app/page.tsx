"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "teacher") {
        router.push("/teacher/dashboard");
      } else {
        router.push("/student/dashboard");
      }
    }
  }, [user, loading, router]);

  if (loading) return null; // or a spinner

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface p-4">
      <div className="max-w-3xl w-full flex flex-col items-center text-center gap-8">

        {/* Brand */}
        <div className="flex items-center gap-2 text-ag-primary">
          <span className="material-symbols-outlined text-[48px]">school</span>
          <h1 className="text-[32px] font-bold text-on-surface tracking-tight">Knotic AI Mentor</h1>
        </div>

        {/* Hero Copy */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[48px] font-bold text-on-surface leading-tight">
            The Classroom, <span className="text-ag-primary">Supercharged</span>.
          </h2>
          <p className="text-[18px] text-on-surface-variant max-w-xl mx-auto">
            Live video classes featuring an autonomous AI Mentor that listens,
            learns student weak points, and jumps in exactly when they need help.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
          <Link
            href="/login"
            className="h-12 px-8 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-medium rounded-xl flex items-center justify-center transition-colors text-[16px]"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="h-12 px-8 bg-ag-primary hover:bg-ag-primary-container text-ag-on-primary hover:text-ag-on-primary-container font-medium rounded-xl flex items-center justify-center transition-colors text-[16px]"
          >
            Get Started
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-12 text-left">
          <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col gap-2">
            <span className="material-symbols-outlined text-ag-tertiary text-[24px]">troubleshoot</span>
            <h3 className="text-[16px] font-semibold text-on-surface">Adaptive Interventions</h3>
            <p className="text-[13px] text-on-surface-variant">The AI listens to the live class and jumps in when it senses confusion.</p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col gap-2">
            <span className="material-symbols-outlined text-ag-secondary text-[24px]">hub</span>
            <h3 className="text-[16px] font-semibold text-on-surface">Knowledge GraphRAG</h3>
            <p className="text-[13px] text-on-surface-variant">Automatically maps out prerequisite concepts to identify the root cause of misunderstandings.</p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col gap-2">
            <span className="material-symbols-outlined text-ag-primary text-[24px]">upload_file</span>
            <h3 className="text-[16px] font-semibold text-on-surface">Syllabus Ingestion</h3>
            <p className="text-[13px] text-on-surface-variant">Upload PDFs, DOCX, and PPTX to give the AI full context on your curriculum.</p>
          </div>
        </div>

      </div>
    </main>
  );
}
