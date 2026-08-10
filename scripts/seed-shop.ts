#!/usr/bin/env bun
/**
 * Seed products, courses, and one full sample book into Sanity.
 * Idempotent — uses createOrReplace with deterministic _id values.
 *
 * Env: SANITY_PROJECT_ID, SANITY_WRITE_TOKEN.
 */
import { createClient } from "@sanity/client";
import { products } from "../src/lib/products";
import { courses } from "../src/lib/courses";

const PROJECT_ID = process.env.SANITY_PROJECT_ID!;
const TOKEN      = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_TOKEN!;

const client = createClient({
  projectId: PROJECT_ID,
  dataset: "production",
  apiVersion: "2024-01-01",
  token: TOKEN,
  useCdn: false,
});

let keyCounter = 0;
const key = () => `k${(++keyCounter).toString(36).padStart(6, "0")}`;
const p = (text: string) => ({
  _type: "block", _key: key(), style: "normal",
  children: [{ _type: "span", _key: key(), text, marks: [] }],
});
const h2 = (text: string) => ({
  _type: "block", _key: key(), style: "h2",
  children: [{ _type: "span", _key: key(), text, marks: [] }],
});
const code = (language: string, code: string) => ({
  _type: "codeBlock", _key: key(), language, code,
});

async function seedProducts() {
  console.log("Seeding products...");
  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    await client.createOrReplace({
      _id: `product.${prod.slug}`,
      _type: "product",
      name: prod.name,
      slug: { _type: "slug", current: prod.slug },
      kind: prod.kind,
      status: prod.status,
      tagline: prod.tagline,
      description: prod.description,
      price: prod.price,
      buyUrl: prod.buyUrl,
      readUrl: prod.readUrl,
      audience: prod.audience,
      topics: prod.topics,
      chapters: prod.chapters,
      pages: prod.pages,
      order: (i + 1) * 10,
    });
    console.log(`  ✓ ${prod.name}`);
  }
}

async function seedCourses() {
  console.log("Seeding courses...");
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    await client.createOrReplace({
      _id: `course.${c.slug}`,
      _type: "course",
      title: c.title,
      slug: { _type: "slug", current: c.slug },
      status: c.status,
      format: c.format,
      tagline: c.tagline,
      description: c.description,
      duration: c.duration,
      price: c.price,
      buyUrl: c.buyUrl,
      waitlistUrl: c.waitlistUrl,
      outcomes: c.outcomes,
      modules: c.modules,
      hours: c.hours,
      prereqs: c.prereqs,
      audience: c.audience,
      order: (i + 1) * 10,
    });
    console.log(`  ✓ ${c.title}`);
  }
}

async function seedBook() {
  console.log("Seeding sample book: The WorkIQ Playbook...");
  const bookId = "book.workiq-playbook";
  const authorId = "author.derek";

  await client.createOrReplace({
    _id: bookId,
    _type: "book",
    title: "The WorkIQ Playbook",
    subtitle: "Ship internal edge apps on Bun · Hono · Astro · Cloudflare in a weekend.",
    slug: { _type: "slug", current: "workiq-playbook" },
    description: "The house-stack scaffolder, the base/overlay model, the flock harness, and the whole opinionated toolkit I use to ship WorkIQ apps at Lockstep. Includes the create-workiq generator, a starter monorepo, and eight canonical patterns from the shop floor.",
    tagline: "One code path, two backends. bun-sqlite locally, Durable-Object SQLite at the edge.",
    author: { _type: "reference", _ref: authorId },
    status: "in-progress",
    priceDisplay: "$99",
    topics: ["Bun", "Hono", "Astro", "Cloudflare", "Durable Objects", "WorkIQ"],
    publishedDate: new Date().toISOString(),
    aboutBody: [
      p("The WorkIQ Playbook is the field guide to the stack I run at Lockstep and use on every internal-tool build. It's opinionated. It covers exactly one path — the one I've walked into production a dozen times — with the pitfalls, the escape hatches, and the seams you'd need to swap pieces later."),
      h2("Who this is for"),
      p("Engineers who want to stop wiring servers and start shipping. If you've deployed a Node or Python app before, you're the audience. Zero Cloudflare knowledge required."),
      h2("Who this isn't for"),
      p("Teams evaluating architectures. This isn't a survey. If you want to compare Cloudflare Workers to Vercel to Fly.io, this book won't help you — it assumes you've picked."),
      h2("How to read it"),
      p("Sequentially the first time; then as a reference. Each chapter builds on the previous, but is written to survive as a standalone if you already know the prerequisite material."),
    ],
    draft: false,
  });
  console.log("  ✓ book landing");

  // Chapters
  const chapters = [
    {
      slug: "why-the-stack",
      title: "Why this stack",
      part: "Part I: Foundations",
      order: 10,
      readMinutes: 8,
      description: "The four tools I run for every new project, and the two I stopped running.",
      body: [
        p("Bun. Hono. Astro. Cloudflare. That's the stack. Every internal tool I've shipped at Lockstep in the last eighteen months runs on some combination of these four."),
        p("Not because they're new or interesting. Because they've stopped being surprising."),
        h2("The four"),
        p("Bun replaces Node as the runtime. It's faster, but the reason to use it isn't speed — it's that it ships with a package manager, a test runner, a bundler, and a TypeScript stripper in the same binary. The tooling stack collapses. `bun install`, `bun test`, `bun run`, done."),
        p("Hono is the API layer. It's small (thin router, type-safe, no runtime overhead) and runs identically on Bun and on Cloudflare Workers. That last part matters more than it sounds — you can run the exact same server locally as you'll run at the edge."),
        p("Astro is the frontend. Static output by default, SSR when you need it, MDX for content, and it composes well with any framework (React, Vue, Svelte) if you want to reach for them for interactive islands."),
        p("Cloudflare is where it all runs. Workers, Durable Objects, D1, KV, R2, Queues, Pages — every primitive you'd wire up on AWS is a first-class product on Cloudflare, cheaper, with a nicer dashboard."),
        h2("The two I stopped"),
        p("I stopped running Postgres for new projects. Durable Object SQLite gives me a single-tenant, strongly-consistent database at the edge, with zero cold start and geographic locality. When I need multi-tenant, I use D1."),
        p("I stopped running Docker for anything that doesn't strictly need it. The Wrangler dev server is faster and closer to production than a local container will ever be for edge code."),
      ],
    },
    {
      slug: "the-scaffolder",
      title: "The create-workiq scaffolder",
      part: "Part I: Foundations",
      order: 20,
      readMinutes: 10,
      description: "One command bootstraps a production-shaped app with tests, CI, and deploy wired.",
      body: [
        p("The scaffolder is where the opinions live. One command generates a repo that has everything you need to ship, and nothing you don't."),
        h2("The command"),
        code("bash", "bun run create-workiq --name=\"MyApp\" --yes --data=do-sqlite"),
        p("Flags:"),
        p("`--name`: the app name. Slugified for directory + Worker binding names."),
        p("`--data`: `do-sqlite` (default), `d1`, or `bun-sqlite`. Controls the data layer."),
        p("`--browser`: adds a Playwright / Browser Rendering tier."),
        p("`--extras`: comma-separated. Any of `queues,workflows,vectorize,email` adds bindings + wrangler config."),
        h2("What it emits"),
        p("Three sibling directories. `src/` is the core (Hono app factory, sync repo, Zod contracts). `web/` is the Astro console (the house UI system, ready to add pages). `cloudflare/` is the edge deployment (front-door Worker, DO, wrangler config, D1 migrations)."),
        p("Plus: a Makefile with the deploy ritual, a flock harness for local runs, a Starlight docs site, and a CI workflow."),
      ],
    },
    {
      slug: "base-overlay-model",
      title: "The base/overlay model",
      part: "Part I: Foundations",
      order: 30,
      readMinutes: 12,
      description: "How to maintain many apps without copy-pasting fixes across them.",
      body: [
        p("If you ship one app, none of this matters. If you ship many — and every serious builder eventually does — you need a way to fix things once and propagate."),
        h2("Three layers"),
        p("Layer 1: `@workiq/*` packages. The shared runtime, API factory, access control, edge front-door, UI kit. You edit these once, every app inherits the fix."),
        p("Layer 2: base-overlay files. Per-app but base-owned — the app.ts factory, the worker entry, the Makefile. Listed in `.workiq/manifest.json`. Kept in sync via `make sync-pull` (pull upstream fixes) and `make sync-push` (promote a fix back)."),
        p("Layer 3: app-owned files. Only these change day-to-day: schema, routes, pages, tests. Everything else you don't touch."),
        h2("What this feels like"),
        p("Building on top means editing Layer 3. Fixing something for all apps means editing Layer 1 or `sync-push`-ing from Layer 2. Maintaining the base means the packages plus the template."),
      ],
    },
  ];

  for (const c of chapters) {
    // Body with keys assigned
    const bodyWithKeys = c.body.map((b, i) => ({ ...b, _key: b._key || `b${i}` }));
    await client.createOrReplace({
      _id: `chapter.${c.slug}`,
      _type: "chapter",
      title: c.title,
      slug: { _type: "slug", current: c.slug },
      book: { _type: "reference", _ref: bookId },
      order: c.order,
      part: c.part,
      readMinutes: c.readMinutes,
      description: c.description,
      publishedDate: new Date().toISOString(),
      body: bodyWithKeys,
      draft: false,
    });
    console.log(`  ✓ chapter: ${c.title}`);
  }
}

async function run() {
  await seedProducts();
  await seedCourses();
  await seedBook();
  console.log("\ndone.");
}

run().catch(e => { console.error(e); process.exit(1); });
