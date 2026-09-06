import { GraphRetrievalAdapter } from "../lib/retrieval/graph-adapter";
import { neo4jDriver } from "../lib/neo4j";

async function test() {
  const adapter = new GraphRetrievalAdapter();
  console.log("Testing Graph Retrieval...");

  const results = await adapter.retrieve("test", {
    classId: "physics-101",
    studentId: "test-student-1",
    confusedConcepts: ["Newton's 2nd Law"],
    tokenBudget: 1000,
    maxResults: 5,
    scoreThreshold: 0
  });

  console.log(JSON.stringify(results, null, 2));

  await neo4jDriver.close();
  process.exit(0);
}

test().catch(console.error);
