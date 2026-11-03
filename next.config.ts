import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@node-rs/argon2", "pg", "pino", "sharp"],
  images: {
    // Uploaded media uses unique, immutable filenames, so optimized variants
    // can be reused for a day instead of being re-encoded on every visit.
    minimumCacheTTL: 86400,
    // Banner photography is served from Wikimedia Commons (src/content/site-images.ts).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
        port: "",
        pathname: "/wiki/Special:FilePath/**",
        search: "?width=1600",
      },
    ],
    // Special:FilePath answers with a redirect to upload.wikimedia.org.
    maximumRedirects: 2,
  },
  experimental: {
    // Dynamic pages have no client cache by default, so every back-and-forth
    // navigation re-renders on the server. Keep recently visited pages warm for
    // a minute; admin edits still invalidate through revalidatePath.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ];

    if (isProduction) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      });
    }

    return [{ source: "/(.*)", headers }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
