/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['*'] },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};
export default nextConfig;
