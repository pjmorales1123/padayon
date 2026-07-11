import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  transpilePackages: ['pdfjs-dist'],
};

export default nextConfig;
