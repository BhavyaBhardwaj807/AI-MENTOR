"use client";

import { useState, useEffect } from "react";
import styles from "./quiz.module.css";

interface QuizQuestion {
  id: string;
  questionText: string;
  options: Record<string, string>;
}

interface Quiz {
  id: string;
  questions: QuizQuestion[];
}

export function QuizModal({
  classId,
  sessionId,
  studentId,
}: {
  classId: string;
  sessionId: string;
  studentId: string;
}) {
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<any[] | null>(null);

  // Poll for active quizzes
  useEffect(() => {
    if (activeQuiz) return; // Stop polling if a quiz is already active on screen

    const pollQuiz = async () => {
      try {
        const res = await fetch(`/api/brain/quiz/active?classId=${classId}&sessionId=${sessionId}`);
        const data = await res.json();
        
        // If we found a quiz, and we haven't already taken it
        if (data.quiz && !localStorage.getItem(`quiz_taken_${data.quiz.id}`)) {
          setActiveQuiz(data.quiz);
        }
      } catch (err) {
        console.error("Failed to poll for quiz", err);
      }
    };

    const interval = setInterval(pollQuiz, 5000);
    return () => clearInterval(interval);
  }, [classId, sessionId, activeQuiz]);

  if (!activeQuiz) return null;

  const handleSelect = (questionId: string, optionKey: string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < activeQuiz.questions.length) {
      alert("Please answer all questions!");
      return;
    }

    try {
      const res = await fetch("/api/brain/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: activeQuiz.id,
          studentId,
          answers,
        }),
      });
      const result = await res.json();
      
      setScore(result.score);
      setFeedback(result.feedback);
      setSubmitted(true);
      
      // Mark as taken so it doesn't pop up again
      localStorage.setItem(`quiz_taken_${activeQuiz.id}`, "true");
      
    } catch (err) {
      console.error("Failed to submit quiz", err);
    }
  };

  const handleClose = () => {
    setActiveQuiz(null);
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setFeedback(null);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Pop-up Assessment</h2>
        
        {!submitted ? (
          <div className={styles.questionsContainer}>
            {activeQuiz.questions.map((q, i) => (
              <div key={q.id} className={styles.questionBlock}>
                <p className={styles.questionText}>
                  {i + 1}. {q.questionText}
                </p>
                <div className={styles.optionsList}>
                  {Object.entries(q.options).map(([key, value]) => (
                    <label key={key} className={styles.optionLabel}>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[q.id] === key}
                        onChange={() => handleSelect(q.id, key)}
                      />
                      <span className={styles.optionText}>{key}: {value}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button className={styles.submitBtn} onClick={handleSubmit}>
              Submit Answers
            </button>
          </div>
        ) : (
          <div className={styles.resultsContainer}>
            <h3>You scored {score} / {activeQuiz.questions.length}!</h3>
            <div className={styles.feedbackList}>
              {feedback?.map((f, i) => (
                <div key={f.questionId} className={f.isCorrect ? styles.correct : styles.incorrect}>
                  Question {i + 1}: {f.isCorrect ? "✅ Correct" : `❌ Incorrect (Answer was ${f.correctAnswer})`}
                </div>
              ))}
            </div>
            <button className={styles.closeBtn} onClick={handleClose}>
              Return to Class
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
