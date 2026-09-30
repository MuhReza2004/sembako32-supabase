import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "app/api/**": ["node_modules/@sparticuz/chromium/**", "public/fonts/**"],
  },
  turbopack: {},
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Satu ekspor saja (F-24): sebelumnya module.exports = withBundleAnalyzer({})
// menimpa config di atas sehingga outputFileTracingIncludes diabaikan.
export default withBundleAnalyzer(nextConfig);
