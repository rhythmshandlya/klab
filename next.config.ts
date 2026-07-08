import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Webernetes ships as browser-oriented ESM; transpile it so Next can process it
  // consistently across Turbopack and webpack. It is only ever imported client-side
  // (see src/lib/kube/simulator.ts) so it never runs during SSR.
  transpilePackages: ["@ngrok/webernetes"],
};

export default nextConfig;
