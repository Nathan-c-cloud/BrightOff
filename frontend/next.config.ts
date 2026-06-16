import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Headers de sécurité injectés sur toutes les réponses Next.js.
  // 'unsafe-inline' sur script-src et style-src est temporaire : Next.js génère
  // des inline scripts (hydration, chunk loading) et les composants utilisent
  // du styling inline. La suppression est listée en dette technique (D9/D10)
  // et nécessitera l'ajout d'un nonce CSP côté middleware Next.js.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}`,
              "frame-ancestors 'none'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
