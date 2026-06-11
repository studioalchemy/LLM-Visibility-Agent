/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['chartjs-node-canvas', 'canvas', 'docx'],
  },
};

module.exports = nextConfig;
