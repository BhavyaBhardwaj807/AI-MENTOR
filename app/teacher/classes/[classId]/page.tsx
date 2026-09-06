"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface TeacherClassDetail {
  id: string;
  name: string;
  subject: string;
  agentName?: string | null;
  joinCode?: string | null;
}

interface TeacherStudent {
  id: string;
  name: string;
  email: string;
}

export default function TeacherClassPage(props: { params: Promise<{ classId: string }> }) {
  const params = use(props.params);
  const { user, loading: authLoading } = useAuth("teacher");

  const [classData, setClassData] = useState<TeacherClassDetail | null>(null);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const [agentNameInput, setAgentNameInput] = useState("");
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [uploadingSyllabus, setUploadingSyllabus] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<TeacherStudent | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`/api/classes/${params.classId}`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load class");
        return data;
      }),
      fetch(`/api/teacher/students?classId=${params.classId}`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load students");
        return data;
      }),
    ]).then(([classInfo, allMyStudents]) => {
      setClassData(classInfo);
      setAgentNameInput(classInfo.agentName || "George");
      setStudents(Array.isArray(allMyStudents) ? allMyStudents : []);
    }).catch((err) => {
      console.error(err);
      setClassData(null);
    })
    .finally(() => setLoading(false));
  }, [user, params.classId]);

  const handleCopyCode = () => {
    if (!classData?.joinCode) return;
    navigator.clipboard.writeText(classData.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSaveAgentName = async () => {
    if (!agentNameInput.trim()) return;
    setSavingAgent(true);
    try {
      const response = await fetch("/api/teacher/classes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: params.classId, agentName: agentNameInput.trim() })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update AI mentor name");
      }
      setClassData((current) => current ? { ...current, agentName: agentNameInput.trim() } : current);
      setIsEditingAgent(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAgent(false);
    }
  };

  const handleUploadSyllabus = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingSyllabus(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("classId", params.classId);

    try {
      const response = await fetch("/api/ingest/material", { method: "POST", body: formData });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to upload material");
      }
      alert("Material uploaded successfully.");
    } catch {
      alert("Failed to upload syllabus");
    } finally {
      setUploadingSyllabus(false);
      e.target.value = "";
    }
  };

  const getAvatarGradient = (name: string) => {
    const colors = [
      "from-blue-500/20 to-purple-500/20 text-blue-200",
      "from-emerald-500/20 to-teal-500/20 text-emerald-200",
      "from-orange-500/20 to-rose-500/20 text-rose-200",
      "from-indigo-500/20 to-cyan-500/20 text-indigo-200",
      "from-amber-500/20 to-orange-500/20 text-amber-200",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center p-20 text-outline text-[14px]">
        <span className="material-symbols-outlined text-[24px] animate-spin mr-2">progress_activity</span>
      </div>
    );
  }

  if (!classData) return <div className="p-8 text-center text-ag-error">Class not found</div>;

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto py-2">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-outline-variant/20">
        <div className="flex items-center gap-4">
          <Link href="/teacher/dashboard" className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface transition-colors" title="Back to Dashboard">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">
                {classData.name}
              </h1>
              <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-[11px] font-medium uppercase tracking-wider rounded">
                {classData.subject}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleCopyCode}
          className="group flex items-center gap-2 bg-surface-container-low hover:bg-surface-container-high px-4 py-1.5 rounded-lg border border-outline-variant/30 transition-all"
        >
          <span className="text-[12px] text-outline group-hover:text-on-surface-variant font-medium">Join Code:</span>
          <span className="text-[18px] font-mono font-bold tracking-widest text-on-surface group-hover:text-ag-primary">
            {classData.joinCode}
          </span>
          <span className={`material-symbols-outlined text-[16px] ml-2 ${copiedCode ? 'text-emerald-500' : 'text-outline group-hover:text-ag-primary'}`}>
            {copiedCode ? "check" : "content_copy"}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Interactive Roster */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-medium text-on-surface">Students ({students.length})</h2>
          </div>

          <div className="relative bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 min-h-[400px] flex flex-wrap content-start justify-start gap-4 shadow-sm">
            {students.length === 0 ? (
              <div className="flex items-center justify-center h-full w-full absolute inset-0 text-[13px] text-outline">
                No students enrolled yet.
              </div>
            ) : (
              students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(selectedStudent?.id === student.id ? null : student)}
                  className={`relative flex flex-col items-center gap-2 group transition-all duration-300 ${selectedStudent?.id === student.id ? 'scale-110' : 'hover:scale-105'}`}
                >
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br flex items-center justify-center text-[16px] font-bold shadow-sm border-2 transition-colors ${getAvatarGradient(student.name)} ${selectedStudent?.id === student.id ? 'border-ag-primary ring-2 ring-ag-primary/20' : 'border-surface-container-highest group-hover:border-outline-variant'}`}>
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={`text-[12px] font-medium max-w-[70px] truncate text-center ${selectedStudent?.id === student.id ? 'text-ag-primary' : 'text-on-surface-variant group-hover:text-on-surface'}`}>
                    {student.name.split(" ")[0]}
                  </span>

                  {selectedStudent?.id === student.id && (
                    <div className="absolute top-[80px] z-[60] w-48 bg-surface-container-high border border-outline-variant shadow-2xl rounded-xl p-3 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2">
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-surface-container-high border-l border-t border-outline-variant" />
                      <span className="text-[14px] font-semibold text-on-surface truncate relative z-10">{student.name}</span>
                      <span className="text-[11px] text-outline truncate relative z-10">{student.email}</span>
                      <div className="h-px w-full bg-outline-variant/20 my-1 relative z-10" />
                      <Link href="/teacher/connect" className="text-[12px] text-ag-primary font-medium hover:underline flex items-center gap-1 w-fit relative z-10">
                         Message
                      </Link>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column: AI Assistant Setup */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <h2 className="text-[16px] font-medium text-on-surface">AI Mentor</h2>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-sm flex flex-col divide-y divide-outline-variant/20">
            {/* Identity */}
            <div className="p-5 flex flex-col gap-3">
              {isEditingAgent ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={agentNameInput}
                    onChange={(e) => setAgentNameInput(e.target.value)}
                    className="flex-1 h-9 px-3 bg-surface border border-ag-primary rounded-lg text-[14px] font-medium text-on-surface outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveAgentName}
                    disabled={savingAgent}
                    className="h-9 px-4 bg-ag-primary text-ag-on-primary text-[13px] font-medium rounded-lg disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between group">
                  <h3 className="text-[20px] font-medium text-on-surface">
                    {classData.agentName}
                  </h3>
                  <button
                    onClick={() => setIsEditingAgent(true)}
                    className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                </div>
              )}
            </div>

            {/* Knowledge Base */}
            <div className="p-5 flex flex-col gap-3">
              <div className="mt-1 relative">
                <input
                  type="file"
                  id="syllabus-upload"
                  disabled={uploadingSyllabus}
                  onChange={handleUploadSyllabus}
                  accept=".pdf,.docx,.pptx"
                  className="hidden"
                />
                <label
                  htmlFor="syllabus-upload"
                  className={`flex items-center justify-center gap-2 h-10 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[13px] font-medium rounded-lg cursor-pointer transition-colors ${uploadingSyllabus ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <span className="material-symbols-outlined text-[18px]">upload</span>
                  {uploadingSyllabus ? "Uploading..." : "Upload Material"}
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
