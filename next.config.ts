import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "app/api/**": [
      "node_modules/@sparticuz/chromium/**",
      "public/fonts/**",
    ],
  },
  turbopack: {},
};

export default nextConfig;
