"use client";

import { useState, useEffect } from "react";
import styles from "./quiz.module.css";

interface QuizQuestion {
  id: string;
  questionText: string;
  options: Record<string, string>;
  correctAnswer?: string;
}

interface Quiz {
  id: string;
  status: string;
  createdAt: string;
  questions: QuizQuestion[];
}

export function TeacherSidePanel({
  classId,
  sessionId,
}: {
  classId: string;
  sessionId: string;
}) {
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  // Poll for active quizzes (drafts or generating)
  useEffect(() => {
    const pollQuiz = async () => {
      try {
        const res = await fetch(`/api/brain/quiz/active?classId=${classId}&sessionId=${sessionId}`);
        const data = await res.json();

        if (data.quiz && data.quiz.status !== "completed") {
          setActiveQuiz(data.quiz);
        } else {
          setActiveQuiz(null);
        }
      } catch (err) {
        console.error("Failed to poll for quiz", err);
      }
    };

    const interval = setInterval(pollQuiz, 5000);
    return () => clearInterval(interval);
  }, [classId, sessionId]);

  if (!activeQuiz) return null;

  const handlePublish = async () => {
    if (!confirm("Are you sure you want to publish this quiz to all students?")) return;
    try {
      await fetch("/api/brain/quiz/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: activeQuiz.id })
      });
      alert("Quiz published!");
      // Active quiz will transition to "published", the panel can still show it or hide it.
    } catch {
      alert("Failed to publish quiz");
    }
  };

  return (
    <div className={styles.teacherPanel}>
      <h3>Co-Teacher Quiz Workspace</h3>
      <p>Status: <strong>{activeQuiz.status.toUpperCase()}</strong></p>

      {activeQuiz.status === "generating" && (
        <p>George is creating questions...</p>
      )}

      {activeQuiz.status === "draft" && (
        <div>
          <p>Review the drafted questions below:</p>
          <div className={styles.draftQuestions}>
            {activeQuiz.questions?.map((q, i) => (
              <div key={q.id} className={styles.draftQuestion}>
                <p><strong>Q{i + 1}:</strong> {q.questionText}</p>
                <ul>
                  {q.options && Object.entries(q.options).map(([k, v]) => (
                    <li key={k} style={{ fontWeight: k === q.correctAnswer ? "bold" : "normal", color: k === q.correctAnswer ? "green" : "inherit" }}>
                      {k}: {v} {k === q.correctAnswer && "(Correct)"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button onClick={handlePublish} className={styles.publishBtn}>Approve & Publish to Class</button>
        </div>
      )}

      {activeQuiz.status === "failed" && (
        <div>
          <p style={{ color: "red" }}>Failed to generate quiz. The AI might have been confused by the context or timed out. Please try asking George to create the quiz again.</p>
        </div>
      )}

      {activeQuiz.status === "published" && (
        <div>
          <p>This quiz is currently live for students.</p>
        </div>
      )}
    </div>
  );
}
