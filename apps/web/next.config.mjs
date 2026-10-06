/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@rpg-chains/shared-types',
    '@rpg-chains/campaign-rules',
    '@rpg-chains/game-config',
    '@rpg-chains/battle-engine',
  ],
};

export default nextConfig;
