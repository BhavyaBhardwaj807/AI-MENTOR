/**
 * scripts/create-collections.ts
 *
 * Creates necessary collections in Qdrant.
 */
import { qdrant, COLLECTIONS } from "../lib/qdrant/index";

const DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || "1536", 10);

async function main() {
  const collections = [
    COLLECTIONS.COURSE_KNOWLEDGE,
    COLLECTIONS.CLASSROOM_EPISODES,
    COLLECTIONS.STUDENT_MEMORIES,
    COLLECTIONS.CONCEPT_EXPLANATIONS,
  ];

  for (const collection of collections) {
    console.log(`Checking collection: ${collection}`);
    try {
      const exists = await qdrant.collectionExists(collection);
      if (!exists.exists) {
        console.log(`Creating collection: ${collection}`);
        await qdrant.createCollection(collection, {
          vectors: {
            size: DIMENSIONS,
            distance: "Cosine",
          },
        });
        console.log(`Created ${collection}`);
      } else {
        console.log(`Collection ${collection} already exists.`);
      }
    } catch (e) {
      console.error(`Error creating collection ${collection}:`, e);
    }
  }
}

main().catch(console.error);
