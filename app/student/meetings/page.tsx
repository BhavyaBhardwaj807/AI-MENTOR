"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface Meeting {
  id: string; title: string; meeting_id: string;
  scheduled_at: string; duration_minutes: number;
  subject: { id: number; name: string };
  teacher: { id: string; name: string };
}

export default function StudentMeetings() {
  const { user, loading: authLoading } = useAuth("student");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    fetch("/api/student/meetings")
      .then((r) => r.json())
      .then((d) => setMeetings(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || !user) return null;

  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(m.scheduled_at).getTime() > now.getTime());
  const past = meetings.filter((m) => new Date(m.scheduled_at).getTime() <= now.getTime());

  const filtered = (list: Meeting[]) =>
    list.filter((m) =>
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.subject.name.toLowerCase().includes(search.toLowerCase()) ||
      m.teacher.name.toLowerCase().includes(search.toLowerCase()) ||
      m.meeting_id.toLowerCase().includes(search.toLowerCase())
    );

  function MeetingRow({ m }: { m: Meeting }) {
    const date = new Date(m.scheduled_at);
    const isUpcoming = date >= now;
    const initials = m.teacher.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    return (
      <div className="group p-4 rounded bg-surface-container-low hover:bg-surface-container transition-all">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 items-start lg:items-center">
          <div className="lg:col-span-4 flex items-start gap-4 w-full">
            <div className="w-10 h-10 rounded bg-ag-secondary-container text-ag-on-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">videocam</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] uppercase px-1.5 py-0.5 rounded bg-surface-container-highest text-ag-secondary tracking-wide">{m.subject.name}</span>
              </div>
              <h2 className="text-[16px] font-medium text-on-surface truncate">{m.title}</h2>
            </div>
          </div>
          <div className="lg:col-span-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-bright flex items-center justify-center text-[13px] font-medium text-on-surface shrink-0">{initials}</div>
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] text-on-surface truncate">{m.teacher.name}</span>
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-col">
            <div className="flex items-center gap-1.5 text-on-surface">
              <span className="material-symbols-outlined text-sm text-outline">calendar_today</span>
              <span className="text-[13px] font-medium">
                {date.toLocaleDateString([], { month: "short", day: "numeric" })}, {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <div className="lg:col-span-1 text-left lg:text-center">
            <span className="text-[11px] text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded">{m.duration_minutes}m</span>
          </div>
          <div className="lg:col-span-2 flex items-center justify-between lg:justify-end gap-3 w-full">
            <span className="text-[11px] text-outline font-mono">{m.meeting_id}</span>
            {isUpcoming ? (
              <Link
                href={`/meeting/${m.meeting_id}`}
                className="px-4 py-2 rounded bg-ag-primary hover:bg-ag-primary-container text-ag-on-primary text-[16px] font-medium transition-colors flex items-center gap-1"
              >
                Join <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded bg-surface-container-high text-on-surface-variant text-[13px]">Past</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[36px] font-semibold text-on-surface tracking-tight">Classes &amp; Meetings</h1>
          <p className="text-[14px] text-on-surface-variant mt-1">Upcoming and past academic sessions.</p>
        </div>
      </div>

      <div className="bg-surface-container-low p-4 rounded mb-6 flex flex-col gap-4">
        <div className="relative w-full lg:w-96">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-lg">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topic, teacher, or ID…"
            className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest text-on-surface rounded text-[13px] placeholder-outline focus:outline-none focus:ring-1 focus:ring-ag-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-outline text-[14px]">
          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Loading…
        </div>
      ) : (
        <>
          {filtered(upcoming).length > 0 && (
            <section className="flex flex-col gap-3 mb-8">
              <h2 className="text-[16px] font-medium text-on-surface flex items-center gap-2">
                Upcoming Classes
                <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[13px]">{filtered(upcoming).length}</span>
              </h2>
              {filtered(upcoming).map((m) => <MeetingRow key={m.id} m={m} />)}
            </section>
          )}
          {filtered(past).length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[16px] font-medium text-on-surface flex items-center gap-2">
                Past Sessions
                <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-[13px]">{filtered(past).length}</span>
              </h2>
              {filtered(past).map((m) => <MeetingRow key={m.id} m={m} />)}
            </section>
          )}
          {filtered(upcoming).length === 0 && filtered(past).length === 0 && (
            <div className="p-12 rounded bg-surface-container-low flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-[48px] text-outline mb-3">event_busy</span>
              <h3 className="text-[16px] font-medium text-on-surface">No sessions found</h3>
              <p className="text-[13px] text-on-surface-variant mt-1 max-w-sm">
                {search ? "Try adjusting your search." : "No meetings have been scheduled for you yet."}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
