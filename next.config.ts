import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  outputFileTracingIncludes: {
    "/api/web/workspace": ["./src/lib/workspace/assets/**", "./src/lib/workspace/browser-adapter.js"],
    "/api/web/version": ["./src/lib/workspace/assets/frozen-ui.html", "./src/lib/workspace/browser-adapter.js"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
