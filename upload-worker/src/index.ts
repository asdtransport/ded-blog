/**
 * ded-blog upload worker — mobile-friendly audio upload direct to R2.
 *
 * Routes:
 *   GET  /               → HTML upload page (matches ded-blog aesthetic)
 *   POST /api/upload      → auth-gated upload to R2; returns { url, key, bytes }
 *   POST /api/episode     → auth-gated patch of a dedwrong episode's audioUrl
 *   GET  /health          → returns "ok"
 *
 * Auth: HMAC-agnostic shared-secret bearer. First visit prompts for password;
 * page stores it in localStorage and sends `Authorization: Bearer <pw>` on every
 * API call. Server checks against UPLOAD_PASSWORD secret and 401s on mismatch.
 */

export interface Env {
  AUDIO: R2Bucket;
  PRIMARY_HOST: string;
  SANITY_PROJECT_ID: string;
  SANITY_DATASET: string;
  UPLOAD_PASSWORD: string;
  SANITY_WRITE_TOKEN?: string;
}

// ─── Utility: extension → content type ──────────────
const MIME: Record<string, string> = {
  m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav",
  ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac",
  aac: "audio/aac", weba: "audio/webm", opus: "audio/opus",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s.-]/g, "").replace(/\s+/g, "-").slice(0, 96);

const todayIso = () => new Date().toISOString().slice(0, 10);

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) },
  });
}

function requireAuth(req: Request, env: Env): Response | null {
  const header = req.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token || token !== env.UPLOAD_PASSWORD) {
    return jsonResponse({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

// ─── HTML page ──────────────────────────────────────
const HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="ded-blog upload" />
<meta name="theme-color" content="#0f766e" />
<title>Upload · ded-blog</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230f766e'/%3E%3Ctext x='16' y='22' font-family='Georgia,serif' font-size='19' font-weight='700' text-anchor='middle' fill='white'%3ED%3C/text%3E%3C/svg%3E" />
<style>
  :root {
    --brand: #0f766e;
    --brand-hover: #0d5f5a;
    --brand-tint: rgba(15,118,110,0.10);
    --bg: #0a0f0e;
    --card: #131a19;
    --card-hi: #1a2322;
    --text: #f5f5f4;
    --muted: #a3a3a0;
    --subtle: #737373;
    --border: #262626;
    --danger: #dc2626;
    --success: #059669;
    --serif: "Source Serif 4", "Iowan Old Style", Georgia, serif;
    --mono: "JetBrains Mono", "SF Mono", Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg); color: var(--text);
    font-family: var(--sans);
    font-size: 16px; line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    min-height: 100vh;
  }
  .shell {
    max-width: 520px; margin: 0 auto; padding: 32px 20px 40px;
  }
  header { margin-bottom: 24px; }
  .brand {
    display: inline-flex; align-items: center; gap: 10px;
    font-weight: 700; font-size: 15px; color: var(--text);
  }
  .brand-mark {
    width: 28px; height: 28px; border-radius: 7px;
    background: linear-gradient(135deg, var(--brand), #0891b2);
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; font-family: var(--serif); font-weight: 700; font-size: 15px;
  }
  h1 {
    font-family: var(--serif);
    font-size: 32px; font-weight: 700; letter-spacing: -0.02em;
    margin: 20px 0 8px; line-height: 1.1;
  }
  .lede {
    color: var(--muted); font-size: 15px; line-height: 1.55;
    margin: 0 0 24px;
  }
  .eyebrow {
    color: var(--brand); font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.6px;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }
  label {
    display: block;
    font-size: 12px; font-weight: 600;
    color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 6px;
  }
  input[type=password], input[type=text], select {
    width: 100%;
    background: var(--card-hi);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 12px 14px;
    border-radius: 8px;
    font-size: 16px;  /* 16px prevents iOS zoom-on-focus */
    font-family: inherit;
    -webkit-appearance: none;
  }
  input:focus, select:focus {
    outline: none;
    border-color: var(--brand);
  }
  .drop {
    border: 2px dashed var(--border);
    border-radius: 12px;
    padding: 32px 20px;
    text-align: center;
    background: var(--card);
    transition: border-color .15s ease, background .15s ease;
    cursor: pointer;
    position: relative;
  }
  .drop:hover, .drop.hover { border-color: var(--brand); background: var(--card-hi); }
  .drop.picked { border-color: var(--brand); border-style: solid; background: var(--card-hi); }
  .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .drop-icon {
    width: 44px; height: 44px; margin: 0 auto 12px;
    border-radius: 10px; background: var(--brand-tint);
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--brand);
  }
  .drop-title { font-family: var(--serif); font-size: 18px; font-weight: 600; margin: 0 0 4px; }
  .drop-sub { color: var(--muted); font-size: 13px; }
  .drop-file {
    display: flex; align-items: center; gap: 12px;
    text-align: left;
  }
  .drop-file-name { font-weight: 600; font-size: 15px; word-break: break-all; }
  .drop-file-meta { color: var(--muted); font-size: 12px; margin-top: 2px; }

  .btn {
    display: block; width: 100%;
    background: var(--brand); color: #fff;
    border: none; border-radius: 10px;
    padding: 14px 20px;
    font-size: 15px; font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background .15s ease, transform .1s ease;
  }
  .btn:hover:not(:disabled) { background: var(--brand-hover); }
  .btn:active:not(:disabled) { transform: scale(0.99); }
  .btn:disabled { background: var(--card-hi); color: var(--subtle); cursor: not-allowed; }
  .btn.secondary {
    background: transparent; color: var(--muted);
    border: 1px solid var(--border);
    margin-top: 8px;
  }
  .btn.secondary:hover:not(:disabled) { background: var(--card-hi); color: var(--text); }

  .progress {
    height: 6px; background: var(--card-hi);
    border-radius: 999px; overflow: hidden;
    margin-top: 12px;
  }
  .progress-bar {
    height: 100%; background: var(--brand);
    width: 0%; transition: width .2s ease;
    border-radius: 999px;
  }

  .result {
    margin-top: 16px;
    padding: 16px;
    background: rgba(5,150,105,0.08);
    border: 1px solid rgba(5,150,105,0.24);
    border-radius: 10px;
    font-size: 14px;
  }
  .result-title { font-weight: 600; margin-bottom: 8px; color: var(--success); }
  .result-url {
    display: block;
    background: var(--card-hi);
    border-radius: 6px;
    padding: 10px 12px;
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--text);
    word-break: break-all;
    margin: 8px 0;
  }
  .result-actions { display: flex; gap: 8px; margin-top: 8px; }
  .result-actions button {
    flex: 1; padding: 10px;
    background: var(--card-hi); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px;
    font-size: 13px; cursor: pointer; font-family: inherit;
    transition: background .12s ease;
  }
  .result-actions button:hover { background: var(--card); }
  .result-actions button.primary { background: var(--brand); color: #fff; border-color: var(--brand); }

  .error {
    margin-top: 12px; padding: 12px 14px;
    background: rgba(220,38,38,0.10);
    border: 1px solid rgba(220,38,38,0.30);
    border-radius: 8px;
    color: #fca5a5; font-size: 14px;
  }

  .options { display: grid; gap: 12px; margin-top: 16px; }
  .options input, .options select { font-size: 15px; }

  .footer {
    margin-top: 32px; text-align: center;
    color: var(--subtle); font-size: 12px;
  }
  .footer a { color: var(--muted); }
  .footer code { color: var(--muted); font-family: var(--mono); font-size: 11px; }

  .hidden { display: none !important; }
</style>
</head>
<body>
<div class="shell">
  <header>
    <a href="/" class="brand">
      <span class="brand-mark">D</span>
      <span>ded-blog upload</span>
    </a>
  </header>

  <div id="lock" class="card">
    <div class="eyebrow">Sign in</div>
    <h1 style="margin-top:6px;font-size:24px;">Enter your upload password</h1>
    <p class="lede">Stored on this device only. You'll only see this screen once.</p>
    <div style="margin-top:12px;">
      <label for="pw">Password</label>
      <input type="password" id="pw" autocomplete="current-password" placeholder="••••••••" />
    </div>
    <button class="btn" id="unlock" style="margin-top:16px;">Unlock →</button>
    <div id="lockError" class="error hidden"></div>
  </div>

  <div id="app" class="hidden">
    <div class="eyebrow">Upload</div>
    <h1>Drop a recording, get a URL.</h1>
    <p class="lede">Files land in R2 at <code style="color:var(--muted);font-family:var(--mono);font-size:12px;">audio.derekethandavis.com</code>. Optional: patch a <a href="/dedwrong" target="_blank" style="color:var(--brand);">dedwrong</a> episode in one shot.</p>

    <div class="card">
      <label class="drop" id="drop">
        <div id="dropEmpty">
          <div class="drop-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M6 9l6-6 6 6"/><path d="M4 21h16"/></svg>
          </div>
          <div class="drop-title">Tap to pick or record</div>
          <div class="drop-sub">Audio: m4a, mp3, wav, ogg · Video: mp4, mov</div>
        </div>
        <div id="dropPicked" class="drop-file hidden">
          <div class="drop-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
          </div>
          <div style="flex:1;min-width:0;">
            <div id="fname" class="drop-file-name"></div>
            <div id="fmeta" class="drop-file-meta"></div>
          </div>
        </div>
        <input type="file" id="file" accept="audio/*,video/*" />
      </label>

      <div class="options">
        <div>
          <label for="dir">Folder (optional)</label>
          <input type="text" id="dir" placeholder="voice" value="voice" />
        </div>
        <div>
          <label for="episode">Patch dedwrong episode (optional)</label>
          <select id="episode">
            <option value="">— None (just upload) —</option>
          </select>
        </div>
      </div>

      <div class="progress hidden" id="progressWrap"><div class="progress-bar" id="progressBar"></div></div>

      <button class="btn" id="upload" style="margin-top:16px;" disabled>Upload</button>

      <div id="result" class="result hidden"></div>
      <div id="error" class="error hidden"></div>
    </div>

    <button class="btn secondary" id="signOut">Sign out on this device</button>

    <div class="footer">
      <p>Bookmark this page on your home screen for one-tap access.<br />
      Files → <a href="https://audio.derekethandavis.com" target="_blank">audio.derekethandavis.com</a> · <a href="/health" target="_blank">Health</a></p>
    </div>
  </div>
</div>

<script>
  const $ = (id) => document.getElementById(id);
  const LS_KEY = "ded-upload-token";

  function humanBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024*1024) return (n/1024).toFixed(1) + " KB";
    return (n/1024/1024).toFixed(1) + " MB";
  }

  async function apiFetch(path, opts = {}) {
    const token = localStorage.getItem(LS_KEY);
    return fetch(path, {
      ...opts,
      headers: {
        "Authorization": "Bearer " + token,
        ...(opts.headers || {}),
      },
    });
  }

  async function verifyAndUnlock(token) {
    localStorage.setItem(LS_KEY, token);
    const r = await apiFetch("/api/whoami");
    if (r.status === 401) {
      localStorage.removeItem(LS_KEY);
      return false;
    }
    return true;
  }

  async function unlock() {
    const pw = $("pw").value.trim();
    if (!pw) return;
    $("unlock").disabled = true;
    $("unlock").textContent = "Checking...";
    const ok = await verifyAndUnlock(pw);
    if (!ok) {
      $("lockError").textContent = "Wrong password.";
      $("lockError").classList.remove("hidden");
      $("unlock").disabled = false;
      $("unlock").textContent = "Unlock →";
      return;
    }
    $("lock").classList.add("hidden");
    $("app").classList.remove("hidden");
    loadEpisodes();
  }

  async function loadEpisodes() {
    try {
      const r = await apiFetch("/api/episodes");
      if (!r.ok) return;
      const data = await r.json();
      const sel = $("episode");
      for (const e of data.episodes || []) {
        const opt = document.createElement("option");
        opt.value = e.slug;
        opt.textContent = "#" + (e.number ?? "?") + " — " + e.title;
        sel.appendChild(opt);
      }
    } catch (e) { /* silent */ }
  }

  $("unlock").addEventListener("click", unlock);
  $("pw").addEventListener("keydown", e => { if (e.key === "Enter") unlock(); });
  $("signOut").addEventListener("click", () => {
    localStorage.removeItem(LS_KEY);
    location.reload();
  });

  // On load, if we have a stored token, try it silently
  (async () => {
    const token = localStorage.getItem(LS_KEY);
    if (!token) return;
    const ok = await verifyAndUnlock(token);
    if (ok) {
      $("lock").classList.add("hidden");
      $("app").classList.remove("hidden");
      loadEpisodes();
    }
  })();

  // File input handling
  const drop = $("drop"), file = $("file"), uploadBtn = $("upload");
  let picked = null;

  file.addEventListener("change", e => {
    picked = e.target.files?.[0] || null;
    if (picked) {
      $("dropEmpty").classList.add("hidden");
      $("dropPicked").classList.remove("hidden");
      $("fname").textContent = picked.name;
      $("fmeta").textContent = humanBytes(picked.size) + " · " + (picked.type || "unknown");
      drop.classList.add("picked");
      uploadBtn.disabled = false;
    }
  });

  ["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add("hover");
  }));
  ["dragleave","drop"].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove("hover");
  }));
  drop.addEventListener("drop", e => {
    const f = e.dataTransfer?.files?.[0];
    if (f) { file.files = e.dataTransfer.files; file.dispatchEvent(new Event("change")); }
  });

  uploadBtn.addEventListener("click", async () => {
    if (!picked) return;
    $("result").classList.add("hidden");
    $("error").classList.add("hidden");
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";
    $("progressWrap").classList.remove("hidden");
    $("progressBar").style.width = "0%";

    const dir = ($("dir").value || "voice").trim();
    const episode = $("episode").value;

    // XHR because fetch doesn't do upload progress
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload?dir=" + encodeURIComponent(dir) +
                        (episode ? "&episode=" + encodeURIComponent(episode) : ""));
    xhr.setRequestHeader("Authorization", "Bearer " + localStorage.getItem(LS_KEY));
    xhr.setRequestHeader("X-Filename", encodeURIComponent(picked.name));
    xhr.setRequestHeader("Content-Type", picked.type || "application/octet-stream");

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        const pct = (e.loaded / e.total) * 100;
        $("progressBar").style.width = pct + "%";
      }
    };
    xhr.onload = () => {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload";
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        const url = data.url;
        const patched = data.episode_patched;
        $("result").innerHTML =
          '<div class="result-title">' + (patched ? "✓ Uploaded and patched episode " + patched : "✓ Uploaded") + '</div>' +
          '<code class="result-url">' + url + '</code>' +
          '<div class="result-actions">' +
            '<button onclick="navigator.clipboard.writeText(\\'' + url + '\\').then(() => this.textContent=\\'Copied!\\')">Copy URL</button>' +
            '<button class="primary" onclick="window.open(\\'' + url + '\\', \\'_blank\\')">Open</button>' +
          '</div>';
        $("result").classList.remove("hidden");
        // Reset picker
        setTimeout(() => {
          picked = null; file.value = "";
          $("dropEmpty").classList.remove("hidden");
          $("dropPicked").classList.add("hidden");
          drop.classList.remove("picked");
          uploadBtn.disabled = true;
          $("progressWrap").classList.add("hidden");
        }, 400);
      } else {
        let msg = "Upload failed (HTTP " + xhr.status + ")";
        try { const e = JSON.parse(xhr.responseText); if (e.error) msg = e.error; } catch {}
        $("error").textContent = msg;
        $("error").classList.remove("hidden");
        $("progressWrap").classList.add("hidden");
      }
    };
    xhr.onerror = () => {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload";
      $("error").textContent = "Network error — try again.";
      $("error").classList.remove("hidden");
      $("progressWrap").classList.add("hidden");
    };
    xhr.send(picked);
  });
</script>
</body>
</html>`;

// ─── Worker entrypoint ──────────────────────────────
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // ── GET / — page
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
      return new Response(HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=60",
        },
      });
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return new Response("ok\n", { headers: { "content-type": "text/plain" } });
    }

    // ── /api/* — auth-gated
    if (url.pathname.startsWith("/api/")) {
      const authErr = requireAuth(req, env);
      if (authErr) return authErr;
    }

    if (req.method === "GET" && url.pathname === "/api/whoami") {
      return jsonResponse({ ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/episodes") {
      const q = `*[_type=="episode" && !(_id in path("drafts.**"))]{number, title, "slug": slug.current} | order(number asc)`;
      const r = await fetch(
        `https://${env.SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/${env.SANITY_DATASET}?query=${encodeURIComponent(q)}`,
        env.SANITY_WRITE_TOKEN
          ? { headers: { Authorization: `Bearer ${env.SANITY_WRITE_TOKEN}` } }
          : undefined
      );
      if (!r.ok) return jsonResponse({ episodes: [] });
      const data: any = await r.json();
      return jsonResponse({ episodes: data.result || [] });
    }

    if (req.method === "POST" && url.pathname === "/api/upload") {
      const dir = url.searchParams.get("dir") || "voice";
      const episode = url.searchParams.get("episode") || null;
      const filenameRaw = req.headers.get("X-Filename") || "recording.m4a";
      const filename = decodeURIComponent(filenameRaw);
      const ct = req.headers.get("Content-Type") || "application/octet-stream";
      if (!req.body) return jsonResponse({ error: "empty body" }, { status: 400 });

      // Read body into memory for R2 put + size (Workers streams to R2 fine either way,
      // but we want a byte count for the response + Sanity patch).
      const buf = await req.arrayBuffer();
      const bytes = buf.byteLength;
      if (bytes === 0) return jsonResponse({ error: "empty file" }, { status: 400 });

      // Compute key
      const name = filename.replace(/^.*[\\\/]/, "");  // strip any path
      const lastDot = name.lastIndexOf(".");
      const ext = (lastDot > -1 ? name.slice(lastDot + 1) : "").toLowerCase();
      const stem = lastDot > -1 ? name.slice(0, lastDot) : name;
      const slug = slugify(stem);
      const contentType = MIME[ext] || ct || "application/octet-stream";
      const key = `${slugify(dir)}/${todayIso()}/${slug || "recording"}.${ext || "bin"}`;

      // Put in R2
      try {
        await env.AUDIO.put(key, buf, {
          httpMetadata: { contentType },
        });
      } catch (e: any) {
        return jsonResponse({ error: `R2 put failed: ${e?.message || e}` }, { status: 500 });
      }

      const publicUrl = `${env.PRIMARY_HOST}/${key}`;

      // Optional: patch dedwrong episode audioUrl
      let patched: string | null = null;
      if (episode && env.SANITY_WRITE_TOKEN) {
        const findQ = `*[_type=="episode" && slug.current=="${episode}"][0]._id`;
        const findRes = await fetch(
          `https://${env.SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/${env.SANITY_DATASET}?query=${encodeURIComponent(findQ)}`,
          { headers: { Authorization: `Bearer ${env.SANITY_WRITE_TOKEN}` } }
        );
        const findJson: any = await findRes.json();
        const epId: string | null = findJson?.result || null;
        if (epId) {
          const patchRes = await fetch(
            `https://${env.SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/${env.SANITY_DATASET}`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                Authorization: `Bearer ${env.SANITY_WRITE_TOKEN}`,
              },
              body: JSON.stringify({
                mutations: [{
                  patch: { id: epId, set: { audioUrl: publicUrl, audioBytes: bytes } },
                }],
              }),
            }
          );
          if (patchRes.ok) patched = episode;
        }
      }

      return jsonResponse({
        ok: true,
        url: publicUrl,
        key,
        bytes,
        contentType,
        episode_patched: patched,
      });
    }

    return jsonResponse({ error: "not found" }, { status: 404 });
  },
};
