#!/usr/bin/env bun
/**
 * ded-blog publish — ship a markdown file straight to Sanity.
 *
 * Reads env from process.env (populate via .env):
 *   SANITY_PROJECT_ID=3onlytdh
 *   SANITY_DATASET=production
 *   SANITY_WRITE_TOKEN=<token with editor rights>
 *
 * Usage:
 *   bun run publish path/to/post.md
 *   bun run publish path/to/post.md --draft         # save as draft
 *   bun run publish path/to/post.md --hero=path.png # attach hero image
 *   bun run publish path/to/post.md --replace       # createOrReplace instead of createIfNotExists
 *   bun run publish path/to/post.md --dry           # print what would be sent, don't hit the API
 *
 * The markdown file's frontmatter shapes the post. Body markdown is converted
 * to Sanity portable text (blocks + code fences + inline marks).
 *
 * Because the Sanity webhook is wired to fire on create/update, a successful
 * publish here rebuilds the site automatically. No manual redeploy needed.
 */
import { createClient } from "@sanity/client";
import { readFileSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

// ─── Env ─────────────────────────────────────────────
const PROJECT_ID = process.env.SANITY_PROJECT_ID;
const DATASET    = process.env.SANITY_DATASET || "production";
const TOKEN      = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_TOKEN;

if (!PROJECT_ID || !TOKEN) {
  console.error("Missing env. Set SANITY_PROJECT_ID and SANITY_WRITE_TOKEN in .env, then re-run.");
  process.exit(1);
}

// ─── Args ────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`ded-blog publish

  bun run publish <path.md>              publish (or update by slug)
    --hero=<image>                        upload image and set as heroImage
    --draft                               keep as draft
    --replace                             overwrite by _id
    --dry                                 print, don't send

  The frontmatter defines: title, description (required), pubDate,
  category, tags[], keywords[], tldr, slug (auto from title), author.
`);
  process.exit(0);
}

const mdPath = args.find(a => !a.startsWith("-"));
if (!mdPath) { console.error("Provide a markdown path."); process.exit(1); }

const flags = {
  draft: args.includes("--draft"),
  replace: args.includes("--replace"),
  dry: args.includes("--dry"),
  hero: args.find(a => a.startsWith("--hero="))?.split("=")[1],
};

// ─── Client ──────────────────────────────────────────
const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: "2024-01-01",
  token: TOKEN,
  useCdn: false,
});

// ─── Parse frontmatter ───────────────────────────────
function parseFrontmatter(src: string): { data: Record<string, any>; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data: Record<string, any> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (val.startsWith('"') && val.endsWith('"')) data[key] = val.slice(1, -1);
    else if (val.startsWith("[") && val.endsWith("]")) {
      data[key] = val.slice(1, -1).split(",").map(s => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
    } else if (val === "true") data[key] = true;
    else if (val === "false") data[key] = false;
    else if (/^\d{4}-\d{2}-\d{2}/.test(val)) data[key] = new Date(val).toISOString();
    else data[key] = val;
  }
  return { data, body: m[2].trim() };
}

// ─── Markdown → Portable Text ────────────────────────
let keyCounter = 0;
const nextKey = () => `k${(++keyCounter).toString(36).padStart(6, "0")}`;

function mdInlineToSpans(text: string): [any[], any[]] {
  const spans: any[] = [];
  const markDefs: any[] = [];
  let remaining = text;

  const emit = (t: string, marks: string[] = []) => {
    if (!t) return;
    spans.push({ _type: "span", _key: nextKey(), text: t, marks });
  };

  while (remaining.length) {
    const link = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) {
      const mk = nextKey();
      markDefs.push({ _key: mk, _type: "link", href: link[2] });
      emit(link[1], [mk]);
      remaining = remaining.slice(link[0].length);
      continue;
    }
    const bold = remaining.match(/^\*\*([^*]+)\*\*/);
    if (bold) { emit(bold[1], ["strong"]); remaining = remaining.slice(bold[0].length); continue; }
    const ital = remaining.match(/^\*([^*\n]+)\*/);
    if (ital) { emit(ital[1], ["em"]); remaining = remaining.slice(ital[0].length); continue; }
    const code = remaining.match(/^`([^`]+)`/);
    if (code) { emit(code[1], ["code"]); remaining = remaining.slice(code[0].length); continue; }
    const nx = remaining.search(/[*`[]/);
    if (nx === -1) { emit(remaining); break; }
    if (nx === 0) { emit(remaining[0]); remaining = remaining.slice(1); continue; }
    emit(remaining.slice(0, nx));
    remaining = remaining.slice(nx);
  }
  return [spans, markDefs];
}

function mdToPortableText(md: string): any[] {
  const blocks: any[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) codeLines.push(lines[i++]);
      i++;
      blocks.push({ _type: "codeBlock", _key: nextKey(), language: lang, code: codeLines.join("\n") });
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h2 || h3) {
      const [spans, marks] = mdInlineToSpans((h2 || h3)![1]);
      blocks.push({ _type: "block", _key: nextKey(), style: h2 ? "h2" : "h3", markDefs: marks, children: spans });
      i++; continue;
    }
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) { buf.push(lines[i].slice(2)); i++; }
      const [spans, marks] = mdInlineToSpans(buf.join(" "));
      blocks.push({ _type: "block", _key: nextKey(), style: "blockquote", markDefs: marks, children: spans });
      continue;
    }
    if (/^-\s+/.test(line)) {
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        const [spans, marks] = mdInlineToSpans(lines[i].replace(/^-\s+/, ""));
        blocks.push({ _type: "block", _key: nextKey(), style: "normal", listItem: "bullet", level: 1, markDefs: marks, children: spans });
        i++;
      }
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const buf = [line]; i++;
    while (i < lines.length && lines[i].trim() && !lines[i].match(/^(#{1,6}\s|>\s|-\s|```)/)) {
      buf.push(lines[i]); i++;
    }
    const [spans, marks] = mdInlineToSpans(buf.join(" "));
    blocks.push({ _type: "block", _key: nextKey(), style: "normal", markDefs: marks, children: spans });
  }
  return blocks;
}

// ─── Hero image upload ───────────────────────────────
async function uploadHeroImage(imagePath: string): Promise<{ assetRef: string; url: string }> {
  const abs = resolve(imagePath);
  statSync(abs);
  const bytes = readFileSync(abs);
  const ext = extname(abs).slice(1).toLowerCase();
  const filename = basename(abs);
  const mime =
    ext === "png"  ? "image/png"  :
    ext === "jpg"  ? "image/jpeg" :
    ext === "jpeg" ? "image/jpeg" :
    ext === "webp" ? "image/webp" :
    ext === "gif"  ? "image/gif"  : "application/octet-stream";

  const url = `https://${PROJECT_ID}.api.sanity.io/v2024-01-01/assets/images/${DATASET}?filename=${encodeURIComponent(filename)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": mime, "Authorization": `Bearer ${TOKEN}` },
    body: bytes,
  });
  if (!r.ok) throw new Error(`asset upload failed: HTTP ${r.status} ${await r.text()}`);
  const j: any = await r.json();
  return { assetRef: j.document._id, url: j.document.url };
}

// ─── Slugify ─────────────────────────────────────────
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 96);

// ─── Author lookup ───────────────────────────────────
async function ensureAuthorRef(): Promise<{ _type: "reference"; _ref: string }> {
  const existing = await client.fetch<string>(`*[_type == "author"][0]._id`);
  return { _type: "reference", _ref: existing || "author.derek" };
}

// ─── Main ────────────────────────────────────────────
async function main() {
  const src = readFileSync(mdPath!, "utf-8");
  const { data, body } = parseFrontmatter(src);

  if (!data.title || !data.description) {
    console.error("Frontmatter must include title and description.");
    process.exit(1);
  }

  const slug = data.slug || slugify(data.title);
  const authorRef = await ensureAuthorRef();

  let heroImage: any = undefined;
  if (flags.hero) {
    console.log(`Uploading hero: ${flags.hero}`);
    const { assetRef } = await uploadHeroImage(flags.hero);
    heroImage = { _type: "image", asset: { _type: "reference", _ref: assetRef } };
    console.log(`  ✓ uploaded (${assetRef})`);
  }

  const doc: any = {
    _id: flags.replace ? `post.${slug}` : undefined,
    _type: "post",
    title: data.title,
    slug: { _type: "slug", current: slug },
    description: data.description,
    tldr: data.tldr,
    pubDate: data.pubDate || new Date().toISOString(),
    updatedDate: data.updatedDate,
    author: authorRef,
    category: data.category || "Engineering",
    tags: data.tags || [],
    keywords: data.keywords || [],
    heroImage,
    body: mdToPortableText(body),
    draft: flags.draft,
  };
  Object.keys(doc).forEach(k => doc[k] === undefined && delete doc[k]);

  if (flags.dry) {
    console.log(JSON.stringify(doc, null, 2));
    return;
  }

  const result = flags.replace
    ? await client.createOrReplace(doc)
    : await client.create(doc);

  console.log(`\n✓ Published: ${result.title}`);
  console.log(`  _id:   ${result._id}`);
  console.log(`  slug:  ${slug}`);
  console.log(`  draft: ${result.draft ? "yes" : "no"}`);
  console.log(`\nWebhook will trigger a rebuild in ~5s. Live in ~90s at:`);
  console.log(`  https://ded-blog.pages.dev/blog/${slug}`);
}

main().catch(e => { console.error(e); process.exit(1); });
