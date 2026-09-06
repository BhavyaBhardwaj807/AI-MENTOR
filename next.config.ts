import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker standalone build
  output: "standalone",

  // Suppress verbose logs for pino transport in edge/server
  serverExternalPackages: ["pino", "pino-pretty"],

  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
