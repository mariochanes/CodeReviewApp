/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Add asset prefix for production deployment
  assetPrefix: process.env.NODE_ENV === 'production' ? '.' : '',
  // Enable static exports for simple hosting
  output: 'export',
  // Disable image optimization since we're using static export
  images: {
    unoptimized: true,
  },
  // Ensure trailing slashes for consistent routing
  trailingSlash: true,
}

module.exports = nextConfig
