import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The sandbox preview reaches the dev server through a proxy, so the Host
// header is not localhost. Extend the allowlist only inside the Base44
// preview sandbox; everywhere else the defaults apply unchanged.
const allowedHosts = ["localhost", "127.0.0.1"];

if (process.env.BASE44_PREVIEW_MODE === "1") {
  const publicSuffix = process.env.BASE44_PUBLIC_HOST_SUFFIX;
  const sandboxDomain = process.env.BASE44_SANDBOX_HOST_DOMAIN;
  if (publicSuffix) allowedHosts.push(`3000-${publicSuffix}`);
  if (sandboxDomain) allowedHosts.push(`.${sandboxDomain}`);
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:8000",
        changeOrigin: false,
      },
    },
  },
});
