import { createClient, type SanityClient } from "@sanity/client";
import { toHTML, type PortableTextHtmlComponents } from "@portabletext/to-html";

/**
 * Sanity client — enabled only when both env vars are present.
 * Without them, the site falls through to MDX (see src/content/).
 */
const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset   = import.meta.env.PUBLIC_SANITY_DATASET || "production";
// Server-only — no PUBLIC_ prefix, so Astro never inlines it into client bundles.
// Used at build (SSG) for authenticated reads.
const readToken = import.meta.env.SANITY_READ_TOKEN;

export const sanityEnabled = Boolean(projectId && projectId !== "REPLACE_ME")

export const sanity: SanityClient | null = sanityEnabled
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2024-01-01",
      useCdn: false,              // authenticated API for build-time freshness
      token: readToken,           // server-side only — never in client bundle
    })
  : null;

// ─── Types (mirror the MDX collection frontmatter) ──────────

export interface UnifiedPost {
  slug: string;
  data: {
    title: string;
    description: string;
    pubDate: Date;
    updatedDate?: Date;
    author: string;
    authorRole: string;
    tags: string[];
    category: string;
    tldr?: string;
    keywords: string[];
    heroImage?: string;
  };
  bodyHtml: string;               // pre-rendered HTML (from portable text)
  headings: { depth: number; slug: string; text: string }[];
  source: "sanity" | "mdx";
}

// ─── Portable Text → HTML with our styling ──────────────────

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

export const portableTextComponents: Partial<PortableTextHtmlComponents> = {
  types: {
    codeBlock: ({ value }: any) => {
      const lang = value.language || "";
      const filename = value.filename ? `<div class="codeblock-filename">${escapeHtml(value.filename)}</div>` : "";
      return `${filename}<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(value.code || "")}</code></pre>`;
    },
    image: ({ value }: any) => {
      if (!value?.asset?._ref || !projectId) return "";
      const [, id, dims, ext] = value.asset._ref.split("-");
      const url = `https://cdn.sanity.io/images/${projectId}/${dataset}/${id}-${dims}.${ext}`;
      return `<img src="${url}" alt="${escapeHtml(value.alt || "")}" loading="lazy" />`;
    },
  },
  block: {
    h2: ({ children, value }: any) => {
      const text = value.children.map((c: any) => c.text).join("");
      return `<h2 id="${slugify(text)}">${children}</h2>`;
    },
    h3: ({ children, value }: any) => {
      const text = value.children.map((c: any) => c.text).join("");
      return `<h3 id="${slugify(text)}">${children}</h3>`;
    },
    blockquote: ({ children }: any) => `<blockquote>${children}</blockquote>`,
  },
  marks: {
    code: ({ children }: any) => `<code>${children}</code>`,
    link: ({ children, value }: any) => {
      const target = value?.blank ? ' target="_blank" rel="noopener"' : "";
      return `<a href="${escapeHtml(value?.href || "#")}"${target}>${children}</a>`;
    },
  },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function extractHeadings(blocks: any[]): { depth: number; slug: string; text: string }[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b: any) => b._type === "block" && (b.style === "h2" || b.style === "h3"))
    .map((b: any) => {
      const text = b.children.map((c: any) => c.text).join("");
      return { depth: b.style === "h2" ? 2 : 3, slug: slugify(text), text };
    });
}

// ─── Queries ───────────────────────────────────────────────

const POST_PROJECTION = /* groq */ `{
  "slug": slug.current,
  title,
  description,
  tldr,
  "pubDate": pubDate,
  "updatedDate": updatedDate,
  "author": author->name,
  "authorRole": author->role,
  category,
  tags,
  keywords,
  body
}`;

export async function fetchSanityPosts(): Promise<UnifiedPost[]> {
  if (!sanity) return [];
  const results = await sanity.fetch<any[]>(
    `*[_type == "post" && !(_id in path("drafts.**")) && draft != true] | order(pubDate desc) ${POST_PROJECTION}`
  );
  return results.map(mapPost);
}

export async function fetchSanityPost(slug: string): Promise<UnifiedPost | null> {
  if (!sanity) return null;
  const result = await sanity.fetch<any>(
    `*[_type == "post" && slug.current == $slug && !(_id in path("drafts.**"))][0] ${POST_PROJECTION}`,
    { slug }
  );
  return result ? mapPost(result) : null;
}

function mapPost(raw: any): UnifiedPost {
  const bodyHtml = raw.body ? toHTML(raw.body, { components: portableTextComponents }) : "";
  return {
    slug: raw.slug,
    data: {
      title: raw.title,
      description: raw.description || "",
      pubDate: new Date(raw.pubDate),
      updatedDate: raw.updatedDate ? new Date(raw.updatedDate) : undefined,
      author: raw.author || "Derek Ethan Davis",
      authorRole: raw.authorRole || "Lead Engineer · Builder",
      tags: raw.tags || [],
      category: raw.category || "Engineering",
      tldr: raw.tldr,
      keywords: raw.keywords || [],
    },
    bodyHtml,
    headings: extractHeadings(raw.body || []),
    source: "sanity",
  };
}
