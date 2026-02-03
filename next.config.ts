import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...config.externals, "chrome-aws-lambda"];
    }
    return config;
  },
  turbopack: {},
};

export default nextConfig;
