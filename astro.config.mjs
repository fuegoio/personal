// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

import react from "@astrojs/react";

export default defineConfig({
  site: "https://alexistac.net/",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [sitemap({
    customSitemaps: ["https://tracktrip.app/docs/sitemap.xml"],
  }), react()],
});