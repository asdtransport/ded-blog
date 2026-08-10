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

// ─── Products ────────────────────────────────
export interface UnifiedProduct {
  slug: string;
  name: string;
  kind: string;
  status: string;
  tagline: string;
  description: string;
  price?: string;
  buyUrl?: string;
  readUrl?: string;
  audience?: string;
  topics: string[];
  chapters?: number;
  pages?: number;
  order: number;
}

export async function getAllProducts(): Promise<UnifiedProduct[]> {
  if (!sanityEnabled || !sanity) return [];
  const results = await sanity.fetch<any[]>(
    `*[_type == "product" && !(_id in path("drafts.**"))] | order(order asc){
      "slug": slug.current, name, kind, status, tagline, description,
      price, buyUrl, readUrl, audience, topics, chapters, pages, order
    }`
  );
  return results.map(r => ({ ...r, topics: r.topics || [], order: r.order ?? 100 }));
}

// ─── Courses ─────────────────────────────────
export interface UnifiedCourse {
  slug: string;
  title: string;
  status: string;
  format: string;
  tagline: string;
  description: string;
  duration?: string;
  price?: string;
  buyUrl?: string;
  waitlistUrl?: string;
  outcomes: string[];
  modules?: number;
  hours?: number;
  prereqs?: string;
  audience?: string;
  order: number;
}

export async function getAllCourses(): Promise<UnifiedCourse[]> {
  if (!sanityEnabled || !sanity) return [];
  const results = await sanity.fetch<any[]>(
    `*[_type == "course" && !(_id in path("drafts.**"))] | order(order asc){
      "slug": slug.current, title, status, format, tagline, description,
      duration, price, buyUrl, waitlistUrl, outcomes, modules, hours, prereqs, audience, order
    }`
  );
  return results.map(r => ({ ...r, outcomes: r.outcomes || [], order: r.order ?? 100 }));
}

// ─── Books + Chapters ────────────────────────
export interface UnifiedBook {
  slug: string;
  title: string;
  subtitle?: string;
  tagline?: string;
  description: string;
  author?: string;
  status: string;
  cover?: string;
  buyPdfUrl?: string;
  priceDisplay?: string;
  topics: string[];
  publishedDate?: Date;
  updatedDate?: Date;
  aboutHtml: string;
}

export interface UnifiedChapter {
  slug: string;
  bookSlug: string;
  bookTitle: string;
  title: string;
  order: number;
  part?: string;
  description?: string;
  readMinutes?: number;
  bodyHtml: string;
  headings: { depth: number; slug: string; text: string }[];
}

import { sanityImageUrl, extractHeadingsExport as extractHeadings } from "./sanity";

export async function getAllBooks(): Promise<UnifiedBook[]> {
  if (!sanityEnabled || !sanity) return [];
  const results = await sanity.fetch<any[]>(
    `*[_type == "book" && !(_id in path("drafts.**")) && draft != true]{
      "slug": slug.current, title, subtitle, tagline, description,
      "author": author->name, status,
      "coverRef": cover.asset._ref,
      buyPdfUrl, priceDisplay, topics,
      publishedDate, updatedDate, aboutBody
    }`
  );
  return results.map(r => ({
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    tagline: r.tagline,
    description: r.description || "",
    author: r.author,
    status: r.status || "in-progress",
    cover: r.coverRef ? sanityImageUrl(r.coverRef) : undefined,
    buyPdfUrl: r.buyPdfUrl,
    priceDisplay: r.priceDisplay,
    topics: r.topics || [],
    publishedDate: r.publishedDate ? new Date(r.publishedDate) : undefined,
    updatedDate: r.updatedDate ? new Date(r.updatedDate) : undefined,
    aboutHtml: r.aboutBody ? toHTML(r.aboutBody, { components: portableTextComponents }) : "",
  }));
}

export async function getBookBySlug(slug: string): Promise<UnifiedBook | null> {
  const all = await getAllBooks();
  return all.find(b => b.slug === slug) || null;
}

export async function getChaptersForBook(bookSlug: string): Promise<UnifiedChapter[]> {
  if (!sanityEnabled || !sanity) return [];
  const results = await sanity.fetch<any[]>(
    `*[_type == "chapter" && !(_id in path("drafts.**")) && draft != true && book->slug.current == $bookSlug] | order(order asc){
      "slug": slug.current, title, order, part, description, readMinutes,
      "bookSlug": book->slug.current, "bookTitle": book->title,
      body
    }`,
    { bookSlug }
  );
  return results.map(r => ({
    slug: r.slug,
    bookSlug: r.bookSlug,
    bookTitle: r.bookTitle,
    title: r.title,
    order: r.order ?? 100,
    part: r.part,
    description: r.description,
    readMinutes: r.readMinutes,
    bodyHtml: r.body ? toHTML(r.body, { components: portableTextComponents }) : "",
    headings: extractHeadings(r.body || []),
  }));
}

export async function getChapter(bookSlug: string, chapterSlug: string): Promise<UnifiedChapter | null> {
  const chapters = await getChaptersForBook(bookSlug);
  return chapters.find(c => c.slug === chapterSlug) || null;
}
