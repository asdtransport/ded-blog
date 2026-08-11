#!/usr/bin/env bun
/**
 * ded-blog upload-audio — push a local audio/media file to Cloudflare R2.
 *
 * Auth: reads CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID from env (see .env).
 * Storage: R2 bucket `ded-blog-audio`.
 * Serving: files are public at https://audio.derekethandavis.com/<key>
 *          (fallback: https://pub-baebfcfceb7141948e37ced9b9752d7b.r2.dev/<key>)
 *
 * Usage:
 *   bun run upload-audio path/to/recording.m4a
 *     → uploads to /voice/2026-08-10/recording.m4a
 *
 *   bun run upload-audio recording.m4a --dir=podcast
 *     → uploads to /podcast/2026-08-10/recording.m4a
 *
 *   bun run upload-audio recording.m4a --key=custom/name.m4a
 *     → uploads to /custom/name.m4a (skips auto date prefix)
 *
 *   bun run upload-audio recording.m4a --copy
 *     → after upload, copy the URL to your clipboard (macOS pbcopy)
 */
import { readFileSync, statSync, existsSync } from "node:fs";
import { basename, extname } from "node:path";
import { spawn } from "node:child_process";

const BUCKET = "ded-blog-audio";
const PRIMARY_HOST = "https://audio.derekethandavis.com";
const R2DEV_HOST   = "https://pub-baebfcfceb7141948e37ced9b9752d7b.r2.dev";

// ─── Args ────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`ded-blog upload-audio

  bun run upload-audio <file>              upload to R2 (auto date prefix)
    --dir=<sub>                             top-level dir (default: voice)
    --key=<full/path.ext>                    use exact key, skip auto-prefix
    --content-type=<mime>                    override content-type
    --copy                                    pbcopy the URL when done (macOS)
    --dry                                     print action, don't upload

Ex:
    bun run upload-audio ~/Desktop/rant.m4a
    bun run upload-audio ~/Desktop/rant.m4a --dir=podcast --copy
`);
  process.exit(0);
}

const filePath = args.find(a => !a.startsWith("-"));
if (!filePath) { console.error("Provide a file path."); process.exit(1); }
if (!existsSync(filePath)) { console.error(`File not found: ${filePath}`); process.exit(1); }

const flag = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const has = (name: string) => args.includes(`--${name}`);

const dir = flag("dir") || "voice";
const customKey = flag("key");
const dry = has("dry");
const copy = has("copy");
const ctOverride = flag("content-type");

// ─── Compute the R2 object key ───────────────────────
const name = basename(filePath);
const ext = extname(name).slice(1).toLowerCase();
const stem = name.slice(0, name.length - ext.length - 1);
const slug = stem.trim().replace(/[^\w\s.-]/g, "").replace(/\s+/g, "-").toLowerCase();
const today = new Date().toISOString().slice(0, 10);           // 2026-08-10
const key = customKey || `${dir}/${today}/${slug}.${ext}`;

// ─── Content type ────────────────────────────────────
const MIME: Record<string, string> = {
  m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav",
  ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac",
  aac: "audio/aac", weba: "audio/webm", opus: "audio/opus",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  txt: "text/plain", pdf: "application/pdf",
};
const contentType = ctOverride || MIME[ext] || "application/octet-stream";
const size = statSync(filePath).size;
const kb = (size / 1024).toFixed(1);

console.log(`
  file:  ${filePath}
  size:  ${kb} KB
  key:   ${key}
  mime:  ${contentType}
  →      ${PRIMARY_HOST}/${key}
`);

if (dry) { console.log("(dry run — no upload)"); process.exit(0); }

// ─── Upload via wrangler ─────────────────────────────
if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN in env. See .env.example.");
  process.exit(1);
}

console.log("Uploading via wrangler...");
const child = spawn("bunx", [
  "wrangler", "r2", "object", "put",
  `${BUCKET}/${key}`,
  `--file=${filePath}`,
  `--content-type=${contentType}`,
  "--remote",
], { stdio: ["ignore", "pipe", "pipe"], env: process.env });

let stdout = ""; let stderr = "";
child.stdout.on("data", d => { const s = d.toString(); stdout += s; process.stdout.write(s); });
child.stderr.on("data", d => { const s = d.toString(); stderr += s; process.stderr.write(s); });

child.on("close", (code) => {
  if (code !== 0) { console.error("\n✗ Upload failed."); process.exit(code || 1); }
  const url = `${PRIMARY_HOST}/${key}`;
  const fallback = `${R2DEV_HOST}/${key}`;

  console.log(`
✓ Uploaded.

  ${url}
  ${fallback}   (fallback until custom-domain SSL settles)
`);

  if (copy) {
    const cp = spawn("pbcopy", { stdio: ["pipe", "inherit", "inherit"] });
    cp.stdin.end(url);
    cp.on("close", () => console.log("  ✓ URL copied to clipboard."));
  }
});
