import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: this server runs headless on neuron and is accessed remotely
  // (e.g. http://neuron:3000) rather than localhost. Without this, Next.js
  // blocks cross-origin dev/HMR resources from the "neuron" origin, the page
  // never hydrates, and client components (like the login form) don't work.
  allowedDevOrigins: ["neuron"],
};

export default nextConfig;
