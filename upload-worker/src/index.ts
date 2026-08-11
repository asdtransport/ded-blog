/**
 * ded-blog-upload — upload.derekethandavis.com
 *
 * Mobile-first audio upload. Password-gated. Sends the audio to Cloudflare
 * Whisper (via the Workers AI binding), structures the transcript, and creates
 * a Sanity draft. Also stashes the raw audio in R2 so you never lose the
 * source recording.
 *
 * GET  /            → upload form
 * POST /            → multipart: file + password → transcribe → Sanity draft
 * GET  /health      → { ok: true }
 */

interface Env {
  AUDIO: R2Bucket;
  AI: Ai;                              // Workers AI binding
  UPLOAD_PASSWORD: string;
  SANITY_WRITE_TOKEN: string;
  SANITY_PROJECT_ID: string;
  SANITY_DATASET: string;
}

const HTML_FORM = (msg = "", err = "") => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0f766e" />
<title>Voice → ded-blog</title>
<style>
  :root {
    --brand: #0f766e; --brand-hover: #0d5f5a;
    --bg: #fafafa; --card: #fff;
    --text: #171717; --text-muted: #525252;
    --border: #e5e5e2;
    color-scheme: light;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    min-height: 100vh;
    padding: env(safe-area-inset-top, 20px) 20px env(safe-area-inset-bottom, 20px);
    display: flex; align-items: flex-start; justify-content: center;
  }
  main {
    max-width: 420px; width: 100%; margin-top: 40px;
  }
  .brand {
    display: flex; align-items: center; gap: 10px; margin-bottom: 32px;
  }
  .brand-mark {
    width: 32px; height: 32px; border-radius: 7px;
    background: linear-gradient(135deg, var(--brand), #0891b2);
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 800; font-size: 15px; font-family: Georgia, serif;
  }
  .brand-name { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
  h1 {
    font-family: "Iowan Old Style", Georgia, serif;
    font-size: 32px; line-height: 1.1; letter-spacing: -0.02em;
    font-weight: 700; margin: 0 0 8px;
  }
  .lede { color: var(--text-muted); font-size: 15px; line-height: 1.5; margin: 0 0 24px; }
  form {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    display: flex; flex-direction: column; gap: 14px;
  }
  label { font-size: 13px; font-weight: 600; color: var(--text-muted); }
  input, select {
    font: inherit;
    background: #fff; color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 16px; /* iOS wants 16px+ to avoid zoom */
    width: 100%;
    -webkit-appearance: none;
  }
  input[type=file] { padding: 10px; }
  input:focus, select:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(15,118,110,.15); }
  .row { display: flex; flex-direction: column; gap: 6px; }
  button {
    background: var(--brand); color: #fff;
    padding: 14px 18px; border: none; border-radius: 8px;
    font-weight: 600; font-size: 15px; cursor: pointer;
    font-family: inherit; margin-top: 4px;
    transition: background .15s ease;
  }
  button:active { background: var(--brand-hover); }
  button:disabled { opacity: 0.6; cursor: wait; }
  .msg { padding: 12px 14px; border-radius: 8px; font-size: 14px; line-height: 1.5; margin-bottom: 16px; }
  .msg.ok { background: rgba(16,185,129,.1); color: #065f46; border: 1px solid rgba(16,185,129,.25); }
  .msg.err { background: rgba(220,38,38,.08); color: #991b1b; border: 1px solid rgba(220,38,38,.2); }
  .msg a { color: var(--brand); font-weight: 600; }
  .fine { font-size: 12px; color: var(--text-muted); margin-top: 8px; }
  .fine a { color: var(--brand); }
</style>
</head>
<body>
<main>
  <div class="brand">
    <span class="brand-mark">D</span>
    <span class="brand-name">derek ethan davis</span>
  </div>
  <h1>Voice → draft.</h1>
  <p class="lede">Record. Upload. Review in Studio. Publish when it's ready.</p>

  ${msg ? `<div class="msg ok">${msg}</div>` : ""}
  ${err ? `<div class="msg err">${err}</div>` : ""}

  <form method="post" enctype="multipart/form-data" id="uploadForm">
    <div class="row">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password" placeholder="notes-from-…" />
    </div>
    <div class="row">
      <label for="audio">Audio file (m4a / mp3 / wav / mp4 · max 25MB)</label>
      <input id="audio" name="audio" type="file" accept="audio/*,video/mp4,.m4a,.mp3,.wav,.webm,.ogg" required />
    </div>
    <div class="row">
      <label for="category">Category</label>
      <select id="category" name="category">
        <option value="Engineering">Engineering</option>
        <option value="AI Agents">AI Agents</option>
        <option value="Cloudflare">Cloudflare</option>
        <option value="MSP">MSP</option>
        <option value="Meta">Meta</option>
        <option value="Philosophy">Philosophy</option>
      </select>
    </div>
    <div class="row">
      <label>
        <input type="checkbox" name="live" style="width:auto;margin-right:8px;" />
        Publish immediately (skip draft review)
      </label>
    </div>
    <button type="submit" id="submitBtn">Upload & transcribe →</button>
  </form>

  <p class="fine">Runs on Cloudflare Whisper. Audio is stored in R2 (private). Transcript lands as a draft in <a href="https://ded-blog.sanity.studio/" target="_blank">Sanity Studio</a>. Site auto-rebuilds when you publish.</p>
</main>
<script>
  const form = document.getElementById('uploadForm');
  const btn = document.getElementById('submitBtn');
  form.addEventListener('submit', () => {
    btn.disabled = true;
    btn.textContent = 'Transcribing… (~10s)';
  });
</script>
</body>
</html>`;

// ─── Structuring heuristics (same as CLI) ─────────────────────────────
function structure(text: string) {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  let title = (sentences[0] || "Voice note").replace(/[.!?]+$/, "").replace(/^(so|and|but|okay|um|uh),?\s+/i, "").slice(0, 90);
  title = title ? title[0].toUpperCase() + title.slice(1) : "Voice note";
  const tldr = sentences[0] || "";
  let description = "";
  for (const s of sentences) {
    if ((description + " " + s).length > 190) break;
    description += (description ? " " : "") + s;
  }
  if (!description) description = tldr;
  const paras: string[] = [];
  for (let i = 0; i < sentences.length; i += 4) paras.push(sentences.slice(i, i + 4).join(" "));
  return { title, description, tldr, bodyParas: paras };
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 96) || "voice-note";

let keyCounter = 0;
const key = () => `k${(++keyCounter).toString(36).padStart(6, "0")}`;

// ─── Handler ────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "ded-blog-upload" });
    }

    if (request.method === "GET") {
      return new Response(HTML_FORM(), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Parse multipart
    let form: FormData;
    try {
      form = await request.formData();
    } catch (e) {
      return new Response(HTML_FORM("", "Bad form data."), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
    }

    const password = String(form.get("password") || "");
    const file = form.get("audio") as File | null;
    const category = String(form.get("category") || "Engineering");
    const live = form.get("live") === "on" || form.get("live") === "true";

    if (password !== env.UPLOAD_PASSWORD) {
      return new Response(HTML_FORM("", "Wrong password."), { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (!file || file.size === 0) {
      return new Response(HTML_FORM("", "Pick an audio file."), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (file.size > 25 * 1024 * 1024) {
      return new Response(HTML_FORM("", `File too big: ${(file.size/1024/1024).toFixed(1)}MB. Whisper limit is 25MB.`), { status: 413, headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // 1. Stash raw audio in R2 (never lose the source).
    //    Matches existing convention: podcast/YYYY-MM-DD/<filename>
    const now = new Date();
    const dateFolder = now.toISOString().slice(0, 10); // "2026-08-11"
    const timeSuffix = now.toISOString().slice(11, 19).replace(/:/g, ""); // "003548"
    const rawName = (file.name || "voice.m4a").replace(/[^\w.\-]/g, "_");
    // Prefix filename with time-of-day so we never collide on same-day multi-uploads
    const r2Key = `podcast/${dateFolder}/${timeSuffix}-${rawName}`;
    const audioBytes = await file.arrayBuffer();
    try {
      await env.AUDIO.put(r2Key, audioBytes, {
        httpMetadata: { contentType: file.type || "audio/mp4" },
        customMetadata: {
          uploadedAt: now.toISOString(),
          sizeBytes: String(file.size),
          origName: file.name || "",
        },
      });
    } catch (e) {
      // Non-fatal — proceed to transcription even if R2 fails
      console.warn("R2 put failed:", (e as Error).message);
    }

    // 2. Transcribe via Workers AI (bound as `AI`)
    let transcript = "";
    try {
      const audioArr = [...new Uint8Array(audioBytes)];
      const aiResp: any = await env.AI.run("@cf/openai/whisper", { audio: audioArr });
      transcript = (aiResp.text || "").trim();
    } catch (e) {
      return new Response(HTML_FORM("", `Transcription failed: ${(e as Error).message}`), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (!transcript) {
      return new Response(HTML_FORM("", "Empty transcript. Silence or unsupported format?"), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // 3. Structure
    const s = structure(transcript);
    const slug = slugify(s.title);
    const body = s.bodyParas.map(p => ({
      _type: "block", _key: key(), style: "normal", markDefs: [],
      children: [{ _type: "span", _key: key(), text: p, marks: [] }],
    }));

    // 4. Create Sanity doc
    const doc = {
      _type: "post",
      title: s.title,
      slug: { _type: "slug", current: slug },
      description: s.description,
      tldr: s.tldr,
      pubDate: new Date().toISOString(),
      author: { _type: "reference", _ref: "author.derek" },
      category,
      tags: ["voice-note"],
      keywords: [],
      body,
      draft: !live,
    };

    const sanityUrl = `https://${env.SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/${env.SANITY_DATASET}`;
    const sanityResp = await fetch(sanityUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.SANITY_WRITE_TOKEN}` },
      body: JSON.stringify({ mutations: [{ create: doc }] }),
    });
    const sanityData: any = await sanityResp.json();
    if (!sanityResp.ok) {
      return new Response(HTML_FORM("", `Sanity error: ${JSON.stringify(sanityData)}`), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
    }

    const createdId = sanityData.results?.[0]?.id || sanityData.results?.[0]?.document?._id;
    const studioLink = createdId
      ? `https://ded-blog.sanity.studio/desk/post;${createdId}`
      : "https://ded-blog.sanity.studio/";
    const publicLink = `https://ded-blog.pages.dev/blog/${slug}`;

    const successMsg = `
      <strong>✓ ${transcript.split(/\s+/).length} words transcribed.</strong><br />
      Title: <em>${s.title}</em><br />
      Status: ${live ? "<strong>Published</strong> — live in ~90s at " + `<a href="${publicLink}" target="_blank">${publicLink}</a>` : "Draft — <a href=\"" + studioLink + "\" target=\"_blank\">review in Studio →</a>"}
    `;
    return new Response(HTML_FORM(successMsg, ""), { headers: { "content-type": "text/html; charset=utf-8" } });
  },
};
