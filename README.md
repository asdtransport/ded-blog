# ded-blog

Personal blog and public build-work site for Derek Ethan Davis.
Astro static · Cloudflare Pages · MDX content collections. Ready to graduate to Sanity CMS and to a WorkIQ skill later.

## Stack

- **Astro 5** (static output)
- **MDX** for posts + pages, typed via Zod content collections
- **Cloudflare Pages** deployment target
- **SEO**: sitemap (`@astrojs/sitemap`), RSS, JSON-LD Article schema, OpenGraph, Twitter cards, canonical
- **AIO / GEO**: `/llms.txt` + `/llms-full.txt` per the [llmstxt.org](https://llmstxt.org) convention, and explicit crawler allows in `robots.txt` (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot)

## Local dev

```bash
bun install
bun run dev            # http://localhost:4321
bun run build          # -> dist/
bun run preview
```

## Add a blog post

Drop an `.mdx` file into `src/content/blog/`:

```mdx
---
title: "Your post title"
description: "One-sentence summary — used in meta description, OG, and card previews."
pubDate: 2026-08-15
category: "Engineering"
tags: ["Cloudflare", "Astro"]
tldr: "Optional one-liner surfaced as a blockquote and to AI summarizers."
keywords: ["seo", "keywords"]
---

Your MDX content here. Use `##` for h2 sections; they'll auto-populate the
sidebar table of contents.
```

The file's basename becomes the URL slug: `my-post.mdx` → `/blog/my-post`.

## Add a static page

Drop an `.mdx` file into `src/content/pages/`:

```mdx
---
title: "Colophon"
description: "How this site is built."
---

Content...
```

`src/content/pages/colophon.mdx` → `/colophon`. (The `about` slug has a dedicated route already.)

## SEO checklist (already wired)

- [x] `<title>` and `<meta name="description">` per page
- [x] Canonical URL per page
- [x] OpenGraph + Twitter card meta
- [x] JSON-LD `Article` schema on posts, `WebSite` schema on other pages
- [x] `sitemap-index.xml` (auto by `@astrojs/sitemap`)
- [x] `robots.txt` with AI crawler allow-list
- [x] `rss.xml` feed
- [x] Semantic HTML (`article`, `nav`, `aside`, `time`)
- [x] `<time datetime="...">` on all dates

## AIO / GEO checklist (already wired)

- [x] `/llms.txt` — spec-compliant index of posts + pages for LLM discovery
- [x] `/llms-full.txt` — full concatenated post text for single-fetch ingestion
- [x] `<meta name="tldr">` per post (surfaces in AI summaries)
- [x] `keywords` frontmatter → `<meta name="keywords">`
- [x] Explicit `Allow` in `robots.txt` for GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot

## Deploy to Cloudflare Pages

**One-time setup:**

```bash
# From this directory, with wrangler authenticated:
wrangler pages project create ded-blog --production-branch main
```

Then either:

**A. Direct upload (fastest):**

```bash
bun run build
wrangler pages deploy dist --project-name=ded-blog
```

**B. Git-connected (recommended):**

1. Push this repo to GitHub (`asdtransport/ded-blog`)
2. In the Cloudflare dashboard: Pages → Create → Connect to Git → select `ded-blog`
3. Build command: `bun run build`  · Output: `dist`  · Node: 22
4. Every push to `main` deploys automatically

**Custom domain:**

Pages → ded-blog → Custom domains → add `blog.derekethandavis.com`.
Cloudflare handles the CNAME automatically since the zone is in the same account.

## Roadmap

- [ ] Wire Sanity CMS as an alternate content source (keep MDX for author-authored posts, Sanity for the rest)
- [ ] Package as a WorkIQ skill once `create-workiq` is refactored to support a "static content site" topology
- [ ] Add search (Pagefind static index)
- [ ] Add OG image auto-generation via a Cloudflare Worker + Satori
