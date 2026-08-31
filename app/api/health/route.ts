import { redis } from "@/lib/redis";
import { qdrant } from "@/lib/qdrant";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  // Redis
  try {
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  // Qdrant
  try {
    await qdrant.getCollections();
    checks.qdrant = "ok";
  } catch {
    checks.qdrant = "error";
  }

  const allOk = Object.values(checks).every((s) => s === "ok");

  return Response.json(
    {
      status: allOk ? "ok" : "degraded",
      version: process.env.npm_package_version ?? "unknown",
      uptime_s: Math.floor(process.uptime()),
      services: checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
