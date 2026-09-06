export default function WeakPoints() {
  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col mb-8">
        <h1 className="text-[36px] font-semibold text-on-surface tracking-tight">Weak Points</h1>
        <p className="text-[14px] text-on-surface-variant mt-1">Topics needing review based on recent coursework and tests.</p>
      </div>

      <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-outline mb-4">
          <span className="material-symbols-outlined text-[28px]">track_changes</span>
        </div>
        <h2 className="text-[20px] font-medium text-on-surface mb-2">Analysis Coming Soon</h2>
        <p className="text-[14px] text-on-surface-variant max-w-md leading-relaxed">
          Weak point analysis will be available once the AI diagnostic API is integrated.
          Your performance data will be analysed automatically after each session and assignment.
        </p>
        <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container text-outline text-[13px]">
          <span className="material-symbols-outlined text-[16px]">info</span>
          Awaiting Agora AI diagnostic endpoint
        </div>
      </div>
    </div>
  );
}
