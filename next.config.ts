import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "app/api/**": ["node_modules/@sparticuz/chromium/**"],
  },
  turbopack: {},
};

export default nextConfig;
