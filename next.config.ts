import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Prisma ships a separate build for Cloudflare Workers that OpenNext swaps in
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;

// Gives `next dev` the same bindings (like the D1 database) as production
initOpenNextCloudflareForDev();
