import type { NextConfig } from "next";

const backendOrigin =
  process.env.BACKEND_ORIGIN?.trim() ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");
 
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/**" },
    ],
  },
  serverExternalPackages: ["socket.io-client"],
  async rewrites() {
    if (!backendOrigin) return [];

    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};
 
export default nextConfig;
