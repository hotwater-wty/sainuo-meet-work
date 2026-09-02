import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
