/**
 * Seed the Sanity dataset with author, posts, pages, and projects derived
 * from the local MDX content. Idempotent — uses createOrReplace with
 * deterministic _id values so repeated runs are safe.
 */
import { createClient } from "@sanity/client";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ID = process.env.SANITY_PROJECT_ID!;
const TOKEN = process.env.SANITY_TOKEN!;

const client = createClient({
  projectId: PROJECT_ID,
  dataset: "production",
  apiVersion: "2024-01-01",
  token: TOKEN,
  useCdn: false,
});

// ─── Frontmatter parser ────────────────────────────
function parseFrontmatter(src: string): { data: Record<string, any>; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data: Record<string, any> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    let val: any = rawVal.trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map(s => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
    } else if (val === "true") val = true;
    else if (val === "false") val = false;
    else if (/^\d{4}-\d{2}-\d{2}/.test(val)) val = new Date(val).toISOString();
    data[key] = val;
  }
  return { data, body: m[2].trim() };
}

// ─── Markdown → Portable Text ──────────────────────
let blockKeyCounter = 0;
const key = () => `k${(++blockKeyCounter).toString(36).padStart(6, "0")}`;

function mdInlineToSpans(text: string): any[] {
  // Handle **bold**, *italic*, `code`, [link](url)
  const spans: any[] = [];
  const markDefs: any[] = [];
  let remaining = text;
  let pos = 0;

  const emit = (t: string, marks: string[] = []) => {
    if (!t) return;
    spans.push({ _type: "span", _key: key(), text: t, marks });
  };

  while (remaining.length) {
    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const markKey = key();
      markDefs.push({ _key: markKey, _type: "link", href: linkMatch[2] });
      emit(linkMatch[1], [markKey]);
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }
    // Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      emit(boldMatch[1], ["strong"]);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    // Italic *text* (single asterisk)
    const italMatch = remaining.match(/^\*([^*\n]+)\*/);
    if (italMatch) {
      emit(italMatch[1], ["em"]);
      remaining = remaining.slice(italMatch[0].length);
      continue;
    }
    // Inline code `x`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      emit(codeMatch[1], ["code"]);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    // Plain char up to next special
    const nextSpecial = remaining.search(/[\*`\[]/);
    if (nextSpecial === -1) { emit(remaining); break; }
    if (nextSpecial === 0) { emit(remaining[0]); remaining = remaining.slice(1); continue; }
    emit(remaining.slice(0, nextSpecial));
    remaining = remaining.slice(nextSpecial);
  }
  return [spans, markDefs];
}

function mdToPortableText(md: string): any[] {
  const blocks: any[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        _type: "codeBlock",
        _key: key(),
        language: lang,
        code: codeLines.join("\n"),
      });
      continue;
    }

    // Heading
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h2 || h3) {
      const [spans, marks] = mdInlineToSpans((h2 || h3)![1]);
      blocks.push({
        _type: "block",
        _key: key(),
        style: h2 ? "h2" : "h3",
        markDefs: marks,
        children: spans,
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      const [spans, marks] = mdInlineToSpans(quoteLines.join(" "));
      blocks.push({
        _type: "block", _key: key(), style: "blockquote",
        markDefs: marks, children: spans,
      });
      continue;
    }

    // List item (single-level, unordered)
    if (/^-\s+/.test(line)) {
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        const [spans, marks] = mdInlineToSpans(lines[i].replace(/^-\s+/, ""));
        blocks.push({
          _type: "block", _key: key(), style: "normal",
          listItem: "bullet", level: 1,
          markDefs: marks, children: spans,
        });
        i++;
      }
      continue;
    }

    // Blank
    if (!line.trim()) { i++; continue; }

    // Paragraph — gather until blank line
    const paraLines = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !lines[i].match(/^(#{1,6}\s|>\s|-\s|```)/)) {
      paraLines.push(lines[i]);
      i++;
    }
    const [spans, marks] = mdInlineToSpans(paraLines.join(" "));
    blocks.push({
      _type: "block", _key: key(), style: "normal",
      markDefs: marks, children: spans,
    });
  }

  return blocks;
}

// ─── Import ─────────────────────────────────────────
async function run() {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const contentDir = join(here, "..", "src", "content");

  // 1. Author
  const authorDoc = {
    _id: "author.derek",
    _type: "author",
    name: "Derek Ethan Davis",
    slug: { _type: "slug", current: "derek-ethan-davis" },
    role: "Lead Engineer · Builder",
    bio: "Engineer and builder. Lead Engineer at Lockstep Technology Group. Builder of AI agent systems, edge infrastructure, and MSP tooling.",
    socials: {
      github: "https://github.com/asdtransport",
      twitter: "https://twitter.com/derekethandavis",
      website: "https://blog.derekethandavis.com",
    },
  };
  await client.createOrReplace(authorDoc);
  console.log(`✓ author: ${authorDoc.name}`);

  // 2. Posts
  const blogDir = join(contentDir, "blog");
  const blogFiles = await readdir(blogDir);
  for (const f of blogFiles.filter(x => x.endsWith(".mdx"))) {
    const src = await readFile(join(blogDir, f), "utf-8");
    const { data, body } = parseFrontmatter(src);
    const slug = f.replace(/\.mdx$/, "");
    const doc = {
      _id: `post.${slug}`,
      _type: "post",
      title: data.title,
      slug: { _type: "slug", current: slug },
      description: data.description,
      tldr: data.tldr,
      pubDate: data.pubDate,
      updatedDate: data.updatedDate,
      author: { _type: "reference", _ref: "author.derek" },
      category: data.category || "Engineering",
      tags: data.tags || [],
      keywords: data.keywords || [],
      body: mdToPortableText(body),
      draft: false,
    };
    await client.createOrReplace(doc);
    console.log(`✓ post: ${slug}`);
  }

  // 3. Pages
  const pagesDir = join(contentDir, "pages");
  const pageFiles = await readdir(pagesDir);
  for (const f of pageFiles.filter(x => x.endsWith(".mdx"))) {
    const src = await readFile(join(pagesDir, f), "utf-8");
    const { data, body } = parseFrontmatter(src);
    const slug = f.replace(/\.mdx$/, "");
    const doc = {
      _id: `page.${slug}`,
      _type: "page",
      title: data.title,
      slug: { _type: "slug", current: slug },
      description: data.description,
      updatedDate: data.updatedDate,
      body: mdToPortableText(body),
      draft: false,
    };
    await client.createOrReplace(doc);
    console.log(`✓ page: ${slug}`);
  }

  // 4. Projects
  const projects = [
    { name: "LTG OS",           slug: "ltg-os",           tag: "Agents",    status: "Active", tagline: "Autonomous agent orchestrator on Cloudflare Workers with GitHub PR-based execution and human supervision.", stack: ["Cloudflare Workers", "GitHub API", "NoteIQ"], url: "https://github.com/asdtransport", order: 10 },
    { name: "LifeMap",          slug: "lifemap",          tag: "Live",      status: "Live",   tagline: "Personal life-management WorkIQ app — time logs, daily logs, routines, and A/B co-parenting cycles on a 168-hour budget grid.", stack: ["Astro", "Hono", "Cloudflare D1", "Zero Trust"], url: "https://lifemap.derekethandavis.com", order: 20 },
    { name: "WorkIQ",           slug: "workiq",           tag: "Framework", status: "Active", tagline: "House stack scaffolder for Bun · Hono · Astro · Drizzle · Cloudflare apps.", stack: ["Bun", "Hono", "Astro", "Drizzle"], url: "https://github.com/asdtransport", order: 30 },
    { name: "NoteIQ",           slug: "noteiq",           tag: "Notes",     status: "Active", tagline: "Voice / text / code note-taker with a git-backed vault and Playwright screen capture.", stack: ["Playwright", "Cloudflare", "Astro"], url: "https://github.com/asdtransport/noteiq", order: 40 },
    { name: "Project Observation", slug: "observation",   tag: "Standards", status: "Alpha",  tagline: "Semantic operations manifest so AI agents can discover and operate websites.", stack: ["JSON-LD", "CLI"], url: "https://github.com/asdtransport", order: 50 },
    { name: "Philosophy Atlas", slug: "philosophy-atlas", tag: "Viz",       status: "Live",   tagline: "Interactive visualization of 60 thinkers via force-directed graph and world map.", stack: ["D3", "Astro"], url: "https://philosophy-atlas.derekethandavis.com", order: 60 },
  ];
  for (const p of projects) {
    await client.createOrReplace({
      _id: `project.${p.slug}`,
      _type: "project",
      name: p.name,
      slug: { _type: "slug", current: p.slug },
      status: p.status,
      tagline: p.tagline,
      url: p.url,
      stack: p.stack,
      order: p.order,
    });
    console.log(`✓ project: ${p.name}`);
  }

  console.log("\ndone.");
}

run().catch(e => { console.error(e); process.exit(1); });
