/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Handle audio files
    config.module.rules.push({
      test: /\.(mp3|wav|ogg)$/,
      use: {
        loader: 'file-loader',
        options: {
          publicPath: '/_next/static/sounds/',
          outputPath: 'static/sounds/',
        },
      },
    });

    // Handle GLB/GLTF files for 3D models
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      use: {
        loader: 'file-loader',
        options: {
          publicPath: '/_next/static/models/',
          outputPath: 'static/models/',
        },
      },
    });

    return config;
  },
  env: {
    READYPLAYERME_SUBDOMAIN: process.env.READYPLAYERME_SUBDOMAIN,
    READYPLAYERME_APP_ID: process.env.READYPLAYERME_APP_ID,
    READYPLAYERME_ORG_ID: process.env.READYPLAYERME_ORG_ID,
    READYPLAYERME_AVATAR_URL: process.env.READYPLAYERME_AVATAR_URL,
    NEXT_PUBLIC_GLADIA_API_KEY: process.env.GLADIA_API_KEY,
  },
};

export default nextConfig; 