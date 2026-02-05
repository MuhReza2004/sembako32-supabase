import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["chrome-aws-lambda", "puppeteer-core"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...config.externals, "chrome-aws-lambda"];
    }
    return config;
  },
  turbopack: {},
};

export default nextConfig;
