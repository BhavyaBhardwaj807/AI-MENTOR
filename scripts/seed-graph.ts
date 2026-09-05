import { runQuery, neo4jDriver } from "../lib/neo4j";

const classId = "physics-101";

const concepts = [
  { name: "Velocity", requires: [] },
  { name: "Time", requires: [] },
  { name: "Acceleration", requires: ["Velocity", "Time"] },
  { name: "Mass", requires: [] },
  { name: "Force", requires: ["Mass", "Acceleration"] },
  { name: "Newton's 2nd Law", requires: ["Force", "Acceleration"] }
];

async function seed() {
  console.log("Seeding Neo4j Knowledge Graph...");

  for (const c of concepts) {
    console.log(`Creating concept: ${c.name}`);
    await runQuery(`
      MERGE (c:Concept {name: $name, classId: $classId})
    `, { name: c.name, classId });

    for (const req of c.requires) {
      console.log(`  -> requires: ${req}`);
      await runQuery(`
        MATCH (c:Concept {name: $name, classId: $classId})
        MERGE (pre:Concept {name: $reqName, classId: $classId})
        MERGE (c)-[:REQUIRES]->(pre)
      `, { name: c.name, reqName: req, classId });
    }
  }
  
  // Create a dummy student with some mastery to test
  // Student masters Mass, but not Acceleration
  await runQuery(`
    MERGE (s:Student {id: "test-student-1"})
    WITH s
    MATCH (mass:Concept {name: "Mass", classId: $classId})
    MERGE (s)-[m:MASTERED]->(mass)
    SET m.confidence = 0.95
  `, { classId });
  
  console.log("Seeding complete.");
  await neo4jDriver.close();
  process.exit(0);
}

seed().catch(console.error);
