import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// Site config — change SITE_URL to your production domain
export default defineConfig({
  site: "https://blog.derekethandavis.com",
  trailingSlash: "never",
  output: "static",
  integrations: [
    mdx(),
    sitemap({
      changefreq: "weekly",
      priority: 0.7,
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: "github-light",
      wrap: false,
    },
  },
  build: {
    format: "file", // clean URLs on Pages: /blog/post-slug
  },
});
