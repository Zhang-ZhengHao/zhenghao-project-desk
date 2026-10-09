import type { NextConfig } from "next";

const previewHeaders = [
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive, nosnippet",
  },
] as const;

const nextConfig = {
  async headers() {
    return [
      {
        headers: [...previewHeaders],
        source: "/:path*",
      },
    ];
  },
  output: "standalone",
  poweredByHeader: false,
} satisfies NextConfig;

export default nextConfig;
