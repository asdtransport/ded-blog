import { defineCollection, z } from "astro:content";

// MDX fallback collections — kept so getCollection() stays defined.
// Primary source of truth is Sanity CMS (see src/lib/content.ts).
// Add MDX files here only if you want them alongside Sanity content;
// Sanity wins on slug conflict.

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default("Derek Ethan Davis"),
    authorRole: z.string().default("Lead Engineer · Builder"),
    tags: z.array(z.string()).default([]),
    category: z.string().default("Engineering"),
    tldr: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    canonical: z.string().optional(),
  }),
});

export const collections = { blog };
