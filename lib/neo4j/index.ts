/**
 * lib/neo4j/index.ts
 *
 * Neo4j driver initialization.
 */

import neo4j from "neo4j-driver";

const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "changeme";

const globalForNeo4j = global as typeof globalThis & {
  neo4jDriver?: neo4j.Driver;
};

export const neo4jDriver: neo4j.Driver =
  globalForNeo4j.neo4jDriver ??
  (globalForNeo4j.neo4jDriver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  ));

export async function runQuery(cypher: string, params: Record<string, unknown> = {}) {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(cypher, params);
    return result;
  } finally {
    await session.close();
  }
}
