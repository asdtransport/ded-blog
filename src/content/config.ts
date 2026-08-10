import { defineCollection, z } from "astro:content";

// Blog posts — the workhorse collection
const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),           // used for meta description + og:description + AIO
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default("Derek Ethan Davis"),
    authorRole: z.string().default("Lead Engineer · Builder"),
    tags: z.array(z.string()).default([]),
    category: z.string().default("Engineering"),
    heroImage: z.string().optional(),  // /og/... path in /public
    draft: z.boolean().default(false),
    // Structured data hints (Article schema)
    canonical: z.string().optional(),
    // AIO / GEO helpers
    tldr: z.string().optional(),        // short answer for AI summaries
    keywords: z.array(z.string()).default([]),
  }),
});

// Static pages (about, projects, uses, colophon, etc.)
const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, pages };
