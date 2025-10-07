/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    testProxy: process.env.NODE_ENV !== "production",
  },
};

module.exports = nextConfig;
