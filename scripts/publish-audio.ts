#!/usr/bin/env bun
/**
 * ded-blog: audio → draft post.
 *
 * Usage:
 *   bun run publish-audio path/to/voice-note.m4a
 *   bun run publish-audio path/to/voice.m4a --title="Optional override"
 *   bun run publish-audio path/to/voice.m4a --live      # publish immediately, don't draft
 *   bun run publish-audio path/to/voice.m4a --raw       # skip structuring, dump transcript as-is
 *   bun run publish-audio path/to/voice.m4a --dry       # print what would be sent
 *
 * Flow:
 *   1. Read the audio file (m4a, mp3, wav, mp4, webm, ogg — anything Whisper eats)
 *   2. POST to Cloudflare Workers AI @cf/openai/whisper for transcription
 *   3. Heuristics on the transcript:
 *        - first sentence → title candidate
 *        - first paragraph → description
 *        - remaining → body, split into paragraphs
 *   4. Create the post as a DRAFT in Sanity (unless --live)
 *   5. Print Studio URL — you review + edit + publish
 *
 * Required env (in .env):
 *   SANITY_PROJECT_ID
 *   SANITY_WRITE_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN     (must have Workers AI Read scope)
 */
import { createClient } from "@sanity/client";
import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`ded-blog audio publish

  bun run publish-audio <audio.m4a> [flags]

  --title="…"    override the auto-derived title
  --category="…" override the default (Engineering)
  --live         publish immediately (default: draft, so you review first)
  --raw          skip title/desc extraction, dump transcript as body
  --dry          print what would be sent

  Accepts m4a, mp3, wav, mp4, webm, ogg, flac — anything Whisper handles.
  Transcription runs on Cloudflare Workers AI (@cf/openai/whisper).
`);
  process.exit(0);
}

const audioPath = args.find(a => !a.startsWith("-"));
if (!audioPath) { console.error("Provide an audio path."); process.exit(1); }

const getFlag = (name: string): string | null => {
  const hit = args.find(a => a.startsWith(`${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : null;
};
const flags = {
  title:    getFlag("--title"),
  category: getFlag("--category") || "Engineering",
  live:     args.includes("--live"),
  raw:      args.includes("--raw"),
  dry:      args.includes("--dry"),
};

// ─── Env ────────────────────────────────────────────
const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID;
const SANITY_TOKEN      = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_TOKEN;
const CF_ACCOUNT_ID     = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_TOKEN          = process.env.CLOUDFLARE_API_TOKEN;

if (!SANITY_PROJECT_ID || !SANITY_TOKEN) {
  console.error("Missing SANITY_PROJECT_ID / SANITY_WRITE_TOKEN in env.");
  process.exit(1);
}
if (!CF_ACCOUNT_ID || !CF_TOKEN) {
  console.error("Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN in env.");
  process.exit(1);
}

// ─── 1. Read audio ──────────────────────────────────
const size = statSync(audioPath).size;
if (size > 25 * 1024 * 1024) {
  console.error(`Audio too large: ${(size/1024/1024).toFixed(1)}MB (Whisper limit ~25MB).`);
  console.error("Trim it or split it into segments and run multiple times.");
  process.exit(1);
}
const bytes = readFileSync(audioPath);
console.log(`📼 ${basename(audioPath)} · ${(size/1024).toFixed(0)}KB · ${extname(audioPath).slice(1) || "unknown"}`);

// ─── 2. Transcribe ──────────────────────────────────
console.log(`🎙  Transcribing via Cloudflare Whisper...`);
const t0 = Date.now();
const resp = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/openai/whisper`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CF_TOKEN}`,
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
  }
);
if (!resp.ok) {
  console.error(`Transcription failed: HTTP ${resp.status}`);
  console.error(await resp.text());
  process.exit(1);
}
const result: any = await resp.json();
const transcript: string = (result.result?.text || "").trim();
const wordCount: number = result.result?.word_count || transcript.split(/\s+/).length;
const dur = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`   ✓ ${wordCount} words in ${dur}s`);

if (!transcript) {
  console.error("Empty transcript. Silence, unsupported format, or upload issue.");
  process.exit(1);
}

// ─── 3. Structure ───────────────────────────────────
type Structured = {
  title: string;
  description: string;
  tldr: string;
  bodyMd: string;
};

function structure(text: string): Structured {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  // Title: first sentence, trimmed of trailing punctuation. Cap at ~80 chars.
  let title = (sentences[0] || "Untitled voice note")
    .replace(/[.!?]+$/, "")
    .replace(/^(so|and|but|okay|um|uh),?\s+/i, ""); // strip vocal filler openers
  title = title.slice(0, 90);
  // Capitalize
  title = title[0].toUpperCase() + title.slice(1);

  // TL;DR: first sentence with terminal punctuation
  const tldr = sentences[0] || "";

  // Description: first 2-3 sentences (max 200 chars) — mirrors what a human would write
  let description = "";
  for (const s of sentences) {
    if ((description + " " + s).length > 190) break;
    description += (description ? " " : "") + s;
  }
  if (!description) description = tldr;

  // Body: group sentences into paragraphs of ~3-4 each (mirrors spoken cadence)
  const bodyParas: string[] = [];
  const remaining = sentences; // include first sentence in body too
  for (let i = 0; i < remaining.length; i += 4) {
    bodyParas.push(remaining.slice(i, i + 4).join(" "));
  }
  const bodyMd = bodyParas.join("\n\n");

  return { title, description, tldr, bodyMd };
}

const structured = flags.raw
  ? { title: flags.title || "Voice note", description: "Raw transcript from voice.", tldr: "", bodyMd: transcript }
  : structure(transcript);

if (flags.title) structured.title = flags.title;

// ─── 4. Slugify + convert body to portable text ─────
const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 96) || "voice-note";

const slug = slugify(structured.title);

let keyCounter = 0;
const key = () => `k${(++keyCounter).toString(36).padStart(6, "0")}`;

// Body paragraphs → portable-text blocks
const body = structured.bodyMd.split(/\n\n+/).map(para => ({
  _type: "block",
  _key: key(),
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", _key: key(), text: para.trim(), marks: [] }],
}));

// ─── 5. Push to Sanity ──────────────────────────────
const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: SANITY_TOKEN,
  useCdn: false,
});

// Ensure author exists — reuse the seeded one
const authorRef = { _type: "reference", _ref: "author.derek" };

const doc: any = {
  _type: "post",
  title: structured.title,
  slug: { _type: "slug", current: slug },
  description: structured.description,
  tldr: structured.tldr,
  pubDate: new Date().toISOString(),
  author: authorRef,
  category: flags.category,
  tags: ["voice-note", "draft"],
  keywords: [],
  body,
  draft: !flags.live,   // default draft; --live opts out
};

if (flags.dry) {
  console.log("\n=== DRY RUN — would send ===");
  console.log(JSON.stringify(doc, null, 2));
  process.exit(0);
}

console.log(`\n💾 Creating ${flags.live ? "published" : "DRAFT"} post: "${structured.title}"`);
const created = await client.create(doc);

console.log(`\n✓ Done`);
console.log(`  _id:    ${created._id}`);
console.log(`  slug:   ${slug}`);
console.log(`  status: ${flags.live ? "LIVE" : "DRAFT — review in Studio"}`);
console.log(`\n  Studio edit link:`);
console.log(`  https://ded-blog.sanity.studio/desk/post;${created._id}`);
if (flags.live) {
  console.log(`\n  Live in ~90s at:`);
  console.log(`  https://ded-blog.pages.dev/blog/${slug}`);
} else {
  console.log(`\n  When you're happy with it, hit Publish in the Studio.`);
  console.log(`  The webhook will trigger a rebuild and the post goes live.`);
}
