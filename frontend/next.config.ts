import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  transpilePackages: ['@uiw/react-md-editor', '@uiw/react-markdown-preview'],
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.BUILD_DIST === 'true' ? '/api' : process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api'
  }
};

export default nextConfig;
