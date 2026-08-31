import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

const globalForQdrant = global as typeof globalThis & {
  qdrant?: QdrantClient;
};

export const qdrant: QdrantClient =
  globalForQdrant.qdrant ??
  (globalForQdrant.qdrant = new QdrantClient({
    url: QDRANT_URL,
    ...(QDRANT_API_KEY ? { apiKey: QDRANT_API_KEY } : {}),
  }));

/** Collection names used across the app */
export const COLLECTIONS = {
  COURSE_KNOWLEDGE: "course_knowledge",
  CLASSROOM_EPISODES: "classroom_episodes",
  STUDENT_MEMORIES: "student_memories",
  CONCEPT_EXPLANATIONS: "concept_explanations",
} as const;
