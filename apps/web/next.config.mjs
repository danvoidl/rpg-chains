/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@rpg-chains/shared-types', '@rpg-chains/campaign-rules'],
};

export default nextConfig;
