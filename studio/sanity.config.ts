import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";

/**
 * Sanity Studio for ded-blog.
 * 1. Create a Sanity project at https://sanity.io/manage
 * 2. Copy your projectId into .env.local as SANITY_PROJECT_ID
 * 3. Run `bun install` and `bun run dev`
 * 4. Deploy Studio with `bun run deploy` — hosted at <name>.sanity.studio
 */
export default defineConfig({
  name: "ded-blog",
  title: "Derek Ethan Davis — Blog Studio",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || process.env.SANITY_PROJECT_ID || "REPLACE_ME",
  dataset: process.env.SANITY_STUDIO_DATASET || "production",
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
});
