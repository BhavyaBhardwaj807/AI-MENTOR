"use client";

export default function MeetingControls({ microphoneOn, cameraOn, onToggleMicrophone, onToggleCamera, onLeave, onStartAgent, agentStatus }: { microphoneOn: boolean; cameraOn: boolean; onToggleMicrophone: () => void; onToggleCamera: () => void; onLeave: () => void; onStartAgent?: () => void; agentStatus?: "idle" | "starting" | "active" }) {
  return <div className="meeting-controls">
    <button className={`control-button ${microphoneOn ? "" : "control-muted"}`} onClick={onToggleMicrophone} aria-label={microphoneOn ? "Mute microphone" : "Unmute microphone"} title={microphoneOn ? "Mute microphone" : "Unmute microphone"}>{microphoneOn ? "🎤" : "🔇"}</button>
    <button className={`control-button ${cameraOn ? "" : "control-muted"}`} onClick={onToggleCamera} aria-label={cameraOn ? "Turn camera off" : "Turn camera on"} title={cameraOn ? "Turn camera off" : "Turn camera on"}>{cameraOn ? "📹" : "🚫"}</button>
    <button className="control-button control-placeholder" disabled aria-label="Screen sharing coming soon" title="Screen sharing coming soon">🖥️</button>
    {agentStatus !== undefined && <button className="control-button" onClick={onStartAgent} disabled={agentStatus !== "idle"} aria-label="Start AI Mentor" title={agentStatus === "active" ? "AI Mentor active" : agentStatus === "starting" ? "Starting AI Mentor…" : "Start AI Mentor"}>{agentStatus === "active" ? "🤖" : agentStatus === "starting" ? "⏳" : "🤖"}</button>}
    <button className="leave-button" onClick={onLeave} aria-label="Leave meeting" title="Leave meeting">📞</button>
  </div>;
}