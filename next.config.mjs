/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "fastfwdus.com" },
    ],
  },
};

export default nextConfig;
