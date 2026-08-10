---
name: ded-blog-publish
description: Publish new posts, pages, or projects to Derek Ethan Davis's blog (ded-blog) via the Sanity Content Lake API. Use whenever the user wants to write, ship, publish, draft, or update content on their personal blog at blog.derekethandavis.com or ded-blog.pages.dev — even if they don't say "Sanity" or "CLI". Trigger on phrases like "publish a post about X", "add a new blog post", "ship this to the blog", "draft an article for ded-blog", "update my about page", "add a new project to my projects page". Handles markdown-to-portable-text conversion, hero image upload to Sanity's asset CDN, publish or draft mode, and relies on the existing Sanity webhook → GitHub repository_dispatch → Cloudflare Pages rebuild loop (no manual redeploy needed). Also handles pages and projects, not only posts.
---

# ded-blog publisher

Ship content to Derek's blog without opening the Sanity Studio or touching git.

## The stack in one paragraph

Astro site on Cloudflare Pages. Sanity CMS (project id `3onlytdh`, dataset `production`) is the source of truth. A Sanity webhook fires on any document change, hits a GitHub `repository_dispatch` endpoint, and CI rebuilds + deploys automatically. So a successful write to Sanity = a fresh site in ~90 seconds.

## When to use this skill

Use it when the user asks to publish anything to the blog. Symptoms:

- "Publish a post about X"
- "Add a blog post"
- "Ship this to the blog"
- "Post this to my blog"
- "Update my about page with this text"
- "Add a new project to the projects page"
- "Draft an article about Y"

Do **not** use it for:

- Editing site design or layout (that's code, git-commit path)
- Changing schemas (that's Studio + `sanity deploy`)
- Debugging deploy failures (that's the deploying/troubleshooting docs)

## Prerequisites

Environment variables (in `.env` at the repo root, or exported):

```
SANITY_PROJECT_ID=3onlytdh
SANITY_DATASET=production
SANITY_WRITE_TOKEN=<Editor-role token>
```

Repo is at `github.com/asdtransport/ded-blog`. Clone if needed:

```bash
git clone https://github.com/asdtransport/ded-blog
cd ded-blog
bun install
```

## Publishing a post — the workflow

### 1. Draft the markdown

Draft the post content in a markdown file. Frontmatter shape:

```md
---
title: "The post title"
description: "One-sentence summary, ≤200 chars. Becomes meta description + OG + card summary."
category: "Engineering"   # or: AI Agents, Cloudflare, MSP, Meta, Philosophy
tags: ["tag1", "tag2"]
tldr: "One-line takeaway. Surfaces to AI summarizers as <meta tldr> and as a blockquote atop the post."
keywords: ["seo", "keyword"]
pubDate: 2026-08-15
---

Body markdown here. Uses `##` and `###` for headings (they become anchor-linked TOC entries).

## A section

Fenced code blocks work with a language:

\`\`\`typescript
const x = 1;
\`\`\`

Inline: **bold**, *italic*, `code`, [links](https://example.com).
Blockquotes with `> `. Unordered lists with `- `.
```

Save it somewhere obvious like `drafts/my-post.md`.

**Field cheat sheet:**

- `title` and `description` are required.
- `slug` is auto-derived from title unless overridden.
- `pubDate` defaults to now.
- `category` should be one of the six values above (dropdown-limited in the Studio).
- `tldr` is high-value for AIO/GEO — always include it.

### 2. Optionally prep a hero image

Landscape orientation. Recommended 1600×900 or larger. Sanity's CDN resizes and reformats automatically. Save it locally, e.g. `drafts/images/my-post-hero.png`.

### 3. Publish

```bash
bun run publish drafts/my-post.md
```

With hero image:

```bash
bun run publish drafts/my-post.md --hero=drafts/images/my-post-hero.png
```

Draft mode (won't appear on live site until unlocked in Studio):

```bash
bun run publish drafts/my-post.md --draft
```

Dry run — print what would be sent, don't hit the API:

```bash
bun run publish drafts/my-post.md --dry
```

Update an existing post by slug:

```bash
# Ensure `slug: existing-slug` is in the frontmatter, then:
bun run publish drafts/my-post.md --replace
```

### 4. Verify

The script prints the live URL. Wait ~90 seconds, curl it:

```bash
curl -o /dev/null -w "%{http_code}\n" https://ded-blog.pages.dev/blog/<slug>
```

Should return `200`. If it returns `404`, check:

1. Was the post created? Query Sanity:
   ```bash
   curl -sG "https://3onlytdh.api.sanity.io/v2024-01-01/data/query/production" \
     --data-urlencode 'query=*[_type=="post" && slug.current==$s][0]{title, draft}' \
     --data-urlencode '$s="<slug>"' \
     -H "Authorization: Bearer $SANITY_WRITE_TOKEN"
   ```
2. Was `--draft` passed by accident? Draft posts don't appear on the site.
3. Did the CI workflow run? Check `github.com/asdtransport/ded-blog/actions`.

## Publishing a page (about / uses / now / etc.)

The CLI is post-focused. To create or update a **page**, use the Sanity API directly:

```bash
curl -X POST \
  -H "Authorization: Bearer $SANITY_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  "https://3onlytdh.api.sanity.io/v2024-01-01/data/mutate/production" \
  -d '{
    "mutations": [{
      "createOrReplace": {
        "_id": "page.colophon",
        "_type": "page",
        "title": "Colophon",
        "slug": {"_type":"slug","current":"colophon"},
        "description": "How this site is built",
        "body": [
          {"_type":"block","_key":"a","style":"normal","children":[{"_type":"span","text":"Body content here."}]}
        ]
      }
    }]
  }'
```

Or open the Studio at `ded-blog.sanity.studio` and use the Page section — better UX for anything with real body content.

## Publishing a project

Similar API mutation, `_type: "project"`, `_id: "project.<slug>"`:

```json
{
  "_id": "project.new-thing",
  "_type": "project",
  "name": "New Thing",
  "slug": {"_type":"slug","current":"new-thing"},
  "tagline": "One-sentence description of the project.",
  "status": "Active",
  "url": "https://github.com/asdtransport/new-thing",
  "stack": ["Bun", "Hono", "Cloudflare"],
  "order": 25
}
```

`status` values: `Active`, `Live`, `Alpha`, `Paused`, `Archived`.

## Common gotchas

- **CLI returns 401** — `SANITY_WRITE_TOKEN` is missing or has the wrong role. Needs Editor. Create at [sanity.io/manage → API → Tokens](https://www.sanity.io/manage).
- **Post published but not appearing** — likely `--draft` was used, or the CI build failed. Check the Actions tab.
- **Hero image not showing** — the projection in `src/lib/sanity.ts` must include `heroImage.asset._ref`. If a schema field is added but the projection isn't updated, the field never reaches the frontend.
- **Markdown formatting lost** — the CLI converter handles paragraphs, H2/H3, code fences, blockquotes, bullets, and inline (bold/italic/code/link). Tables, footnotes, inline images do NOT survive the conversion. For those, use the Studio.

## Communication style with Derek

Derek is Lead Engineer at an MSP, terse, expects working code and honest status. When publishing on his behalf:

1. Confirm what you're publishing (title + one-line summary)
2. Publish it
3. Report: slug, live URL, whether it's a draft, expected propagation time
4. If verification fails, say so and diagnose — don't gloss over

Do not ask permission for every small choice (category, tag) — pick reasonable defaults based on the content and mention what you picked so he can correct if needed.

## Related files in the repo

- `scripts/publish.ts` — the CLI itself
- `src/lib/sanity.ts` — the Sanity client + portable text rendering
- `studio/schemas/index.ts` — schemas (post, page, author, project)
- `src/content/docs/content-model.mdx` — full field reference
- `src/content/docs/troubleshooting.mdx` — known issues and fixes

## Rotation reminder

If any Sanity token is exposed (chat, screenshot, log), rotate it at [sanity.io/manage → API → Tokens](https://www.sanity.io/manage) and update:

1. GitHub Actions secret `SANITY_READ_TOKEN` (for CI builds)
2. Local `.env` with the new `SANITY_WRITE_TOKEN` (for CLI)
