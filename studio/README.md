# ded-blog Studio

Sanity Studio for authoring blog posts, pages, projects, and author bios.

## First-time setup

1. Create a Sanity account and project at https://sanity.io/manage
2. Copy your `projectId` (visible at top of the project page)
3. Create `.env.local` in this folder:

   ```
   SANITY_STUDIO_PROJECT_ID=your_project_id_here
   SANITY_STUDIO_DATASET=production
   ```

4. Also add these to the Astro app's environment (so it can fetch content):

   In `../.env`:
   ```
   PUBLIC_SANITY_PROJECT_ID=your_project_id_here
   PUBLIC_SANITY_DATASET=production
   ```

## Run Studio locally

```bash
bun install
bun run dev            # http://localhost:3333
```

## Deploy Studio

```bash
bun run deploy         # hosts at <name>.sanity.studio
```

Choose a subdomain when prompted (e.g. `ded-blog`). Studio then lives at
https://ded-blog.sanity.studio and any changes flow into the Astro site
via the Sanity CDN.

## Schemas

- **post** — blog posts with rich body (portable text), TL;DR, category, tags, keywords
- **page** — static pages (about, uses, colophon, etc.)
- **author** — author profiles with avatar and socials
- **project** — public build-work entries

## How content flows to the site

The Astro app (in `../src/lib/sanity.ts`) fetches from the Sanity CDN using
GROQ queries. When Sanity isn't configured, the app falls back to the
MDX files in `../src/content/*/`. Both sources can coexist.

To trigger a rebuild on publish, add a Sanity webhook that hits your
Cloudflare Pages deploy hook URL (Cloudflare dashboard → Pages → Settings →
Builds & deployments → Deploy hooks).
