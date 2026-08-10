import { defineCollection, z } from "astro:content";

// MDX fallback collections — kept so getCollection() stays defined.
// Primary source of truth is Sanity CMS (see src/lib/content.ts).

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

// Docs — MDX-based, sits at /docs/*. Order controls sidebar ordering.
const docs = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    group: z.string().default("General"),
    order: z.number().default(100),
    updatedDate: z.coerce.date().optional(),
  }),
});

export const collections = { blog, docs };
