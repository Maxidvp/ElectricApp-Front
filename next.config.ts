import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir el dev server desde la red local (ej. http://192.168.1.19:3001).
  // Sin esto Next bloquea los chunks JS con 403 y la página queda en negro.
  allowedDevOrigins: ['192.168.1.19'],
};

export default nextConfig;
