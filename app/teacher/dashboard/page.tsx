"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface ClassData {
  id: string;
  name: string;
  subject: string;
  agentName: string;
  joinCode: string;
}

export default function TeacherDashboard() {
  const { user, loading: authLoading } = useAuth("teacher");
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Class Modal State
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassSubject, setNewClassSubject] = useState("");
  const [creatingClass, setCreatingClass] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((data) => {
        setClasses(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [user]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !newClassSubject.trim()) return;
    setCreatingClass(true);
    try {
      const res = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClassName.trim(), subject: newClassSubject.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setClasses([...classes, data]);
        setShowCreateClass(false);
        setNewClassName("");
        setNewClassSubject("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingClass(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto py-6">
      {/* Sleek Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8">
        <div className="flex flex-col">
          <h1 className="text-[28px] font-semibold text-on-surface tracking-tight">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="text-[15px] text-on-surface-variant mt-1">
            Manage your classes and AI configurations.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {classes.length > 0 && (
            <button
              onClick={() => setShowCreateClass(true)}
              className="h-10 px-5 bg-ag-primary hover:bg-ag-primary/90 text-ag-on-primary rounded-lg text-[14px] font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create Class
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-20 text-outline text-[14px]">
          <span className="material-symbols-outlined text-[24px] animate-spin mr-2">progress_activity</span>
          Loading your classes...
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 px-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm">
          <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px] text-outline">school</span>
          </div>
          <h2 className="text-[18px] font-medium text-on-surface mb-2">No Classes Yet</h2>
          <p className="text-[14px] text-on-surface-variant max-w-md text-center mb-6">
            Get started by creating a new class. Your students will be able to join using a unique code.
          </p>
          <button
            onClick={() => setShowCreateClass(true)}
            className="h-10 px-5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg text-[14px] font-medium flex items-center gap-2 transition-colors"
          >
            Create Your First Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {classes.map((c) => (
            <Link
              href={`/teacher/classes/${c.id}`}
              key={c.id}
              className="group flex flex-col bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm hover:shadow-md hover:border-outline-variant/50 transition-all duration-200"
            >
              {/* Card Header (Gradient / Visual Anchor) */}
              <div className="h-24 bg-gradient-to-br from-ag-primary/10 to-ag-tertiary/10 flex items-center p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-ag-primary/5 to-transparent rounded-full -translate-y-10 translate-x-10 transform" />
                <h3 className="text-[18px] font-semibold text-on-surface relative z-10 line-clamp-2">
                  {c.name}
                </h3>
              </div>

              {/* Card Body */}
              <div className="p-5 flex flex-col gap-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-surface-container-low text-on-surface-variant text-[11px] font-medium uppercase tracking-wider rounded-md">
                    {c.subject}
                  </span>
                  <div className="flex items-center gap-1 text-[12px] font-mono text-on-surface-variant bg-surface-container-lowest px-2 py-1 rounded border border-outline-variant/30">
                    <span className="material-symbols-outlined text-[14px]">vpn_key</span>
                    {c.joinCode}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-outline-variant/20 flex items-center justify-between text-[13px] text-on-surface-variant group-hover:text-ag-primary transition-colors">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                    {c.agentName}
                  </span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Class Modal */}
      {showCreateClass && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-2xl p-6 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-semibold text-on-surface tracking-tight">Create a New Class</h2>
              <button onClick={() => setShowCreateClass(false)} className="text-outline hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container-low">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateClass} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-on-surface">Class Name</label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. Advanced Calculus 101"
                  className="h-11 px-3 bg-surface-container-low border border-outline-variant/30 rounded-lg text-[14px] text-on-surface focus:outline-none focus:border-ag-primary focus:ring-1 focus:ring-ag-primary transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-on-surface">Subject (Code)</label>
                <input
                  type="text"
                  required
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  placeholder="e.g. MATH"
                  className="h-11 px-3 bg-surface-container-low border border-outline-variant/30 rounded-lg text-[14px] text-on-surface focus:outline-none focus:border-ag-primary focus:ring-1 focus:ring-ag-primary transition-all"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setShowCreateClass(false)}
                  className="px-4 py-2 rounded-lg text-[14px] font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingClass || !newClassName.trim() || !newClassSubject.trim()}
                  className="px-6 py-2 bg-ag-primary text-ag-on-primary rounded-lg text-[14px] font-medium transition-all disabled:opacity-50 hover:bg-ag-primary/90 hover:shadow-md"
                >
                  {creatingClass ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
