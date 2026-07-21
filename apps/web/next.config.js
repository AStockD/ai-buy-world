/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@aibuyworld/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.taobaocdn.com' },
      { protocol: 'https', hostname: '**.tmall.com' },
    ],
  },
};

module.exports = nextConfig;
