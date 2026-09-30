import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Tauri собирает фронтенд в статику и забирает её из ../out (см. tauri.conf.json) */
  output: "export",
  /* В статическом экспорте нет серверной оптимизации картинок */
  images: { unoptimized: true },
};

export default nextConfig;
