/**
 * lib/db/schema.ts
 *
 * Complete PostgreSQL schema for Knotic, defined with Drizzle ORM.
 * This is the canonical source of truth for all relational data.
 *
 * Includes BetterAuth schema requirements (user, session, account, verification).
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  real,
  bigint,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ── BetterAuth Core Tables ──────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),

  // Custom fields
  studentId: text("student_id").unique(), // school-issued student ID
  role: text("role", { enum: ["teacher", "student", "admin"] }).notNull().default("student"),
  languagePreference: text("language_preference").default("en"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  issuer: text("issuer"),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ── Classes ────────────────────────────────────────────────────────────

export const classes = pgTable("classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  teacherId: text("teacher_id").references(() => user.id),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),
  agentName: text("agent_name").default("George"),
  joinCode: text("join_code").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Class members (enrollment) ─────────────────────────────────────────

export const classMembers = pgTable(
  "class_members",
  {
    classId: uuid("class_id")
      .references(() => classes.id)
      .notNull(),
    studentId: text("student_id")
      .references(() => user.id)
      .notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.classId, table.studentId] })],
);

// ── Concepts (knowledge graph nodes in relational form) ────────────────

export const concepts = pgTable("concepts", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id")
    .references(() => classes.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  difficultyLevel: integer("difficulty_level").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Concept prerequisites (edges in the prerequisite graph) ────────────

export const conceptPrerequisites = pgTable(
  "concept_prerequisites",
  {
    conceptId: uuid("concept_id")
      .references(() => concepts.id)
      .notNull(),
    requiresId: uuid("requires_id")
      .references(() => concepts.id)
      .notNull(),
    weight: real("weight").default(1.0),
    confirmedBy: text("confirmed_by", { enum: ["teacher", "auto"] }).default("auto"),
  },
  (table) => [primaryKey({ columns: [table.conceptId, table.requiresId] })],
);

// ── Meeting Sessions (one meeting = one session) ───────────────────────

export const meetingSessions = pgTable(
  "meeting_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id")
      .references(() => classes.id)
      .notNull(),
    agoraChannel: text("agora_channel").notNull(),
    agoraAgentId: text("agora_agent_id"),
    agoraSttAgentId: text("agora_stt_agent_id"),
    topic: text("topic"),
    status: text("status", { enum: ["pending", "live", "ended"] })
      .default("pending")
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("meeting_sessions_agora_channel_idx").on(table.agoraChannel)],
);

// ── Session participants ───────────────────────────────────────────────

export const sessionParticipants = pgTable(
  "session_participants",
  {
    sessionId: uuid("session_id")
      .references(() => meetingSessions.id)
      .notNull(),
    userId: text("user_id")
      .references(() => user.id)
      .notNull(),
    agoraUid: text("agora_uid"),
    role: text("role", { enum: ["teacher", "student", "ai"] }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.userId] })],
);

// ── Transcript segments ────────────────────────────────────────────────

export const transcriptSegments = pgTable(
  "transcript_segments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .references(() => meetingSessions.id)
      .notNull(),
    speakerUid: text("speaker_uid").notNull(),
    speakerRole: text("speaker_role", { enum: ["teacher", "student", "ai"] }),
    content: text("content").notNull(),
    startedAtMs: bigint("started_at_ms", { mode: "number" }),
    endedAtMs: bigint("ended_at_ms", { mode: "number" }),
    turnId: integer("turn_id"),
    isFinal: boolean("is_final").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("transcript_segments_session_time_idx").on(
      table.sessionId,
      table.startedAtMs,
    ),
  ],
);

// ── Course materials ───────────────────────────────────────────────────

export const courseMaterials = pgTable("course_materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id")
    .references(() => classes.id)
    .notNull(),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  embedStatus: text("embed_status", {
    enum: ["pending", "processing", "done", "failed"],
  })
    .default("pending")
    .notNull(),
  chunkCount: integer("chunk_count").default(0),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
});

// ── Mastery records (per student per concept) ──────────────────────────

export const masteryRecords = pgTable(
  "mastery_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: text("student_id")
      .references(() => user.id)
      .notNull(),
    conceptId: uuid("concept_id")
      .references(() => concepts.id)
      .notNull(),
    confidence: real("confidence").default(0.0).notNull(),
    evidence: text("evidence"),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("mastery_records_student_concept_idx").on(
      table.studentId,
      table.conceptId,
    ),
  ],
);

// ── Learning events (extracted by dreaming worker) ─────────────────────

export const learningEvents = pgTable(
  "learning_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .references(() => meetingSessions.id)
      .notNull(),
    studentId: text("student_id")
      .references(() => user.id)
      .notNull(),
    conceptId: uuid("concept_id").references(() => concepts.id),
    eventType: text("event_type", {
      enum: ["mastery", "confusion", "partial", "question", "breakthrough"],
    }).notNull(),
    confidence: real("confidence"),
    evidence: text("evidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("learning_events_session_idx").on(table.sessionId),
    index("learning_events_student_idx").on(table.studentId),
  ],
);

// ── Assignments (Ported from feat/ai-mentor-auth) ───────────────────────

export const assignments = pgTable("assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id")
    .references(() => classes.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const assignmentSubmissions = pgTable(
  "assignment_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .references(() => assignments.id)
      .notNull(),
    studentId: text("student_id")
      .references(() => user.id)
      .notNull(),
    status: text("status", { enum: ["pending", "submitted"] }).default("pending").notNull(),
    content: text("content"),
    fileName: text("file_name"),
    filePath: text("file_path"),
    fileType: text("file_type"),
    fileSize: integer("file_size"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("assignment_submissions_assignment_student_idx").on(
      table.assignmentId,
      table.studentId,
    ),
  ],
);

// ── AI interaction logs ────────────────────────────────────────────────

export const aiInteractions = pgTable(
  "ai_interactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").references(() => meetingSessions.id),
    turnId: integer("turn_id"),
    speakerUid: text("speaker_uid"),
    triggerType: text("trigger_type", {
      enum: ["question", "teacher_cmd", "confusion", "direct", "intervention"],
    }),
    path: text("path", { enum: ["fast", "slow"] }),
    userMessage: text("user_message"),
    responseText: text("response_text"),
    latencyMs: integer("latency_ms"),
    modelUsed: text("model_used"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    ragUsed: boolean("rag_used").default(false),
    wasInterrupted: boolean("was_interrupted").default(false),
    traceId: text("trace_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("ai_interactions_session_idx").on(table.sessionId)],
);

// ── Student memories (PG side — Qdrant has the vectors) ────────────────

export const studentMemories = pgTable(
  "student_memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: text("student_id")
      .references(() => user.id)
      .notNull(),
    classId: uuid("class_id")
      .references(() => classes.id)
      .notNull(),
    conceptId: uuid("concept_id").references(() => concepts.id),
    memoryType: text("memory_type", {
      enum: ["mastery", "confusion", "explanation_worked", "explanation_failed"],
    }).notNull(),
    content: text("content").notNull(),
    confidence: real("confidence").default(0.0),
    superseded: boolean("superseded").default(false),
    qdrantPointId: text("qdrant_point_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("student_memories_student_class_idx").on(
      table.studentId,
      table.classId,
    ),
  ],
);

// ── Quizzes ────────────────────────────────────────────────────────────

export const quizzes = pgTable("quizzes", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").references(() => meetingSessions.id),
  classId: uuid("class_id")
    .references(() => classes.id)
    .notNull(),
  generatedBy: text("generated_by", { enum: ["ai", "teacher"] }).default("ai"),
  status: text("status", { enum: ["generating", "draft", "published", "completed", "failed"] }).default("generating").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id")
    .references(() => quizzes.id)
    .notNull(),
  conceptId: uuid("concept_id").references(() => concepts.id),
  questionText: text("question_text").notNull(),
  correctAnswer: text("correct_answer"),
  options: jsonb("options"),
  difficulty: integer("difficulty").default(1),
});

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .references(() => quizzes.id)
      .notNull(),
    studentId: text("student_id")
      .references(() => user.id)
      .notNull(),
    questionId: uuid("question_id")
      .references(() => quizQuestions.id)
      .notNull(),
    answerGiven: text("answer_given"),
    isCorrect: boolean("is_correct"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("quiz_attempts_quiz_student_question_idx").on(
      table.quizId,
      table.studentId,
      table.questionId,
    ),
  ],
);

// ── Session reports ────────────────────────────────────────────────────

export const sessionReports = pgTable("session_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => meetingSessions.id)
    .notNull()
    .unique(),
  topicsCovered: text("topics_covered"),
  learningGaps: text("learning_gaps"),
  recommendations: text("recommendations"),
  fullReportMd: text("full_report_md"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
});

// ── Job audit trail ────────────────────────────────────────────────────

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    queueName: text("queue_name").notNull(),
    jobId: text("job_id").notNull(),
    jobType: text("job_type", {
      enum: ["embed", "classify", "dream", "report"],
    }).notNull(),
    status: text("status", {
      enum: ["pending", "running", "done", "failed"],
    })
      .default("pending")
      .notNull(),
    payload: jsonb("payload"),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("job_runs_status_idx").on(table.status)],
);

// ── Messages (Direct messaging between Teacher and Student) ─────────────

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: text("student_id")
    .references(() => user.id)
    .notNull(),
  teacherId: text("teacher_id")
    .references(() => user.id)
    .notNull(),
  senderRole: text("sender_role", { enum: ["teacher", "student"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
