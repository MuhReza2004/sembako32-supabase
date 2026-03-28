import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "app/api/**": ["node_modules/@sparticuz/chromium/**", "public/fonts/**"],
  },
  turbopack: {},
};
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

module.exports = withBundleAnalyzer({});

export default nextConfig;
