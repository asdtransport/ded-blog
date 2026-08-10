import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";
import { sanity, sanityEnabled, fetchSanityPosts, fetchSanityPost, portableTextComponents, type UnifiedPost } from "./sanity";

/**
 * Content layer that merges Sanity + MDX and presents a single, uniform post
 * interface to the pages. Sanity wins on slug conflict — this lets you edit a
 * Sanity draft of an MDX post without duplicating it.
 *
 * Every route ultimately consumes UnifiedPost (from ./sanity.ts).
 */

async function mdxPostToUnified(entry: CollectionEntry<"blog">): Promise<UnifiedPost> {
  const { Content, headings } = await entry.render();
  // Render Content to a string via Astro's container API would be heavier;
  // for MDX we pass Content through in the route instead. We wrap headings
  // and metadata in the UnifiedPost shape but leave bodyHtml empty; the
  // MDX route branch renders <Content/> directly.
  return {
    slug: entry.slug,
    data: {
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.pubDate,
      updatedDate: entry.data.updatedDate,
      author: entry.data.author,
      authorRole: entry.data.authorRole,
      tags: entry.data.tags,
      category: entry.data.category,
      tldr: entry.data.tldr,
      keywords: entry.data.keywords,
    },
    bodyHtml: "", // MDX renders via <Content /> in the route
    headings: headings as any,
    source: "mdx",
  };
}

export async function getAllPosts(): Promise<UnifiedPost[]> {
  const [sanityPosts, mdxEntries] = await Promise.all([
    sanityEnabled ? fetchSanityPosts() : Promise.resolve([] as UnifiedPost[]),
    getCollection("blog", ({ data }) => !data.draft),
  ]);
  const mdxPosts = await Promise.all(mdxEntries.map(mdxPostToUnified));

  // Merge — Sanity wins on slug conflict.
  const bySlug = new Map<string, UnifiedPost>();
  for (const p of mdxPosts) bySlug.set(p.slug, p);
  for (const p of sanityPosts) bySlug.set(p.slug, p);

  return Array.from(bySlug.values()).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
  );
}

export async function getPostBySlug(slug: string): Promise<
  | { unified: UnifiedPost; mdxEntry: CollectionEntry<"blog"> | null }
  | null
> {
  // Try Sanity first
  if (sanityEnabled) {
    const s = await fetchSanityPost(slug);
    if (s) return { unified: s, mdxEntry: null };
  }
  // Fall back to MDX
  const mdxEntries = await getCollection("blog", ({ data }) => !data.draft);
  const entry = mdxEntries.find(e => e.slug === slug);
  if (!entry) return null;
  const unified = await mdxPostToUnified(entry);
  return { unified, mdxEntry: entry };
}
// ─── Pages (about, uses, now, etc.) ────────────────
import { toHTML } from "@portabletext/to-html";

export interface UnifiedPage {
  slug: string;
  data: { title: string; description: string; updatedDate?: Date };
  bodyHtml: string;
}

export async function getAllPages(): Promise<UnifiedPage[]> {
  if (!sanityEnabled || !sanity) return [];
  const results = await sanity.fetch<any[]>(
    `*[_type == "page" && !(_id in path("drafts.**")) && draft != true]{title,"slug":slug.current,description,updatedDate,body}`
  );
  return results.map(mapPage);
}

export async function getPageBySlug(slug: string): Promise<UnifiedPage | null> {
  if (!sanityEnabled || !sanity) return null;
  const raw = await sanity.fetch<any>(
    `*[_type == "page" && slug.current == $slug && !(_id in path("drafts.**"))][0]{title,"slug":slug.current,description,updatedDate,body}`,
    { slug }
  );
  return raw ? mapPage(raw) : null;
}

function mapPage(raw: any): UnifiedPage {
  return {
    slug: raw.slug,
    data: {
      title: raw.title,
      description: raw.description || "",
      updatedDate: raw.updatedDate ? new Date(raw.updatedDate) : undefined,
    },
    bodyHtml: raw.body ? toHTML(raw.body, { components: portableTextComponents }) : "",
  };
}
