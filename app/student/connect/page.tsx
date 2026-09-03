"use client";

import { useEffect, useState } from "react";

interface Teacher {
  id: string;
  name: string;
  email: string;
}
interface Message { id: string; teacher_id: string; sender_role: "student" | "teacher"; content: string; created_at: string; }

export default function ConnectWithTeacher() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/student/teachers")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to fetch teachers");
        return data;
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setTeachers(list);
        if (list.length > 0) setSelectedTeacher(list[0]);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTeacher) return;
    setMessagesLoading(true);
    fetch(`/api/messages?teacher_id=${selectedTeacher.id}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to fetch messages"); return data; })
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setMessagesLoading(false));
  }, [selectedTeacher]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeacher || !message.trim()) return;
    setSending(true); setError("");
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacher_id: selectedTeacher.id, content: message.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to send message");
      setMessages((prev) => [...prev, data]); setMessage("");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to send message"); }
    finally { setSending(false); }
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">Connect with Teacher</h1>
        <p className="text-[13px] text-outline">Message your course instructors</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 w-full" style={{ minHeight: "640px" }}>
        {/* Left pane */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col shrink-0 bg-surface-container-low rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-surface-container-low flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-medium text-on-surface">Faculty Directory</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-2 p-3 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-[14px] text-outline">
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Loading teachers…
              </div>
            ) : error ? (
              <p className="p-5 text-center text-[14px] text-ag-error">{error}</p>
            ) : teachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <span className="material-symbols-outlined text-[40px] text-outline mb-3">school</span>
                <p className="text-[14px] text-on-surface-variant">No connected teachers yet.</p>
              </div>
            ) : (
              teachers.map((teacher) => (
                <button type="button" key={teacher.id} onClick={() => setSelectedTeacher(teacher)} className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${selectedTeacher?.id === teacher.id ? "bg-surface-container-high" : "bg-surface-container hover:bg-surface-container-high"}`}>
                  <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-[13px] font-medium text-on-surface shrink-0">
                    {teacher.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-on-surface truncate">{teacher.name}</p>
                    <p className="text-[12px] text-on-surface-variant truncate">{teacher.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right pane */}
        <div className="flex-1 flex flex-col bg-surface-container-low rounded-xl overflow-hidden shadow-sm">
          {!selectedTeacher ? <div className="flex-1 flex flex-col items-center justify-center p-12 text-center"><span className="material-symbols-outlined text-[40px] text-outline mb-3">chat_bubble</span><h2 className="text-[20px] font-medium text-on-surface mb-2">Your Teachers</h2><p className="text-[14px] text-on-surface-variant max-w-md">Teachers connected to your student account will appear in the faculty directory.</p></div> : <>
            <div className="p-4 bg-surface-container-high border-b border-outline-variant/20"><p className="text-[16px] font-medium text-on-surface">{selectedTeacher.name}</p><p className="text-[12px] text-on-surface-variant">{selectedTeacher.email}</p></div>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
              {messagesLoading ? <p className="text-[14px] text-outline text-center p-6">Loading messages…</p> : messages.length === 0 ? <p className="text-[14px] text-outline text-center p-6">No messages yet. Start the conversation.</p> : messages.map((item) => <div key={item.id} className={`max-w-[80%] rounded-lg px-3 py-2 ${item.sender_role === "student" ? "self-end bg-ag-primary text-ag-on-primary" : "self-start bg-surface-container-high text-on-surface"}`}><p className="text-[14px] whitespace-pre-wrap">{item.content}</p><p className="text-[11px] opacity-70 mt-1">{new Date(item.created_at).toLocaleString()}</p></div>)}
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t border-outline-variant/20 flex gap-2"><input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} placeholder="Write a message…" className="flex-1 bg-surface-container-lowest rounded-lg px-3 py-2 text-[14px] text-on-surface focus:outline-none focus:ring-1 focus:ring-ag-primary" /><button disabled={sending || !message.trim()} className="px-4 py-2 rounded-lg bg-ag-primary text-ag-on-primary text-[13px] font-medium disabled:opacity-50">{sending ? "Sending…" : "Send"}</button></form>
          </>}
        </div>
      </div>
    </div>
  );
}
