export default function ConnectWithTeacher() {
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
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <span className="material-symbols-outlined text-[40px] text-outline mb-3">forum</span>
            <p className="text-[14px] text-on-surface-variant">
              Teacher messaging is not yet available.
            </p>
          </div>
        </div>

        {/* Right pane */}
        <div className="flex-1 flex flex-col bg-surface-container-low rounded-xl overflow-hidden shadow-sm">
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-outline mb-4">
              <span className="material-symbols-outlined text-[28px]">chat_bubble</span>
            </div>
            <h2 className="text-[20px] font-medium text-on-surface mb-2">Messaging Coming Soon</h2>
            <p className="text-[14px] text-on-surface-variant max-w-md leading-relaxed">
              Direct messaging with teachers will be available once the messaging API is integrated.
            </p>
            <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container text-outline text-[13px]">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Awaiting student-teacher messaging endpoint
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
