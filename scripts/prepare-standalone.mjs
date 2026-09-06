import { cp, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";

const standaloneDir = ".next/standalone";
const standaloneNextDir = `${standaloneDir}/.next`;

if (!existsSync(`${standaloneDir}/server.js`)) {
  throw new Error("Standalone server is missing. Run `npm run build` first.");
}

await mkdir(standaloneNextDir, { recursive: true });

await rm(`${standaloneNextDir}/static`, { recursive: true, force: true });
await cp(".next/static", `${standaloneNextDir}/static`, { recursive: true });

if (existsSync("public")) {
  await rm(`${standaloneDir}/public`, { recursive: true, force: true });
  await cp("public", `${standaloneDir}/public`, { recursive: true });
}

console.log("Standalone assets prepared.");
