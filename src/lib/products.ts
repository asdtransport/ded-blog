/**
 * Products config — the paid/gated side of the site.
 *
 * Migration path: this file gets replaced by a Sanity `product` schema when
 * you're ready to author products through the Studio. Same shape, same routes.
 */

export type ProductStatus = "available" | "preorder" | "waitlist" | "draft";

export interface Product {
  slug: string;
  name: string;
  kind: "book" | "guide" | "template" | "playbook" | "toolkit";
  status: ProductStatus;
  tagline: string;              // one-sentence hook
  description: string;          // 2–3 sentence pitch
  price?: string;               // display price, e.g. "$29" or "Free"
  buyUrl?: string;              // Gumroad / Lemon Squeezy / etc.
  readUrl?: string;             // free-to-read URL (or /books/{slug} in the future)
  chapters?: number;
  pages?: number;
  audience: string;             // one-liner "who this is for"
  topics: string[];             // browsable tags
}

export const products: Product[] = [
  {
    slug: "workiq-playbook",
    name: "The WorkIQ Playbook",
    kind: "playbook",
    status: "waitlist",
    tagline: "Ship internal edge apps on Bun · Hono · Astro · Cloudflare in a weekend.",
    description:
      "The house-stack scaffolder, the base/overlay model, the flock harness, and the whole opinionated toolkit I use to ship WorkIQ apps at Lockstep. Includes the create-workiq generator, a starter monorepo, and eight canonical patterns from the shop floor.",
    price: "$99",
    audience: "Engineers running MSP tooling, internal tools, or edge-native SaaS side-projects.",
    topics: ["Bun", "Hono", "Astro", "Cloudflare", "Durable Objects"],
    chapters: 12,
    pages: 180,
  },
  {
    slug: "agent-systems-on-cloudflare",
    name: "Agent Systems on Cloudflare",
    kind: "book",
    status: "preorder",
    tagline: "Build an autonomous agent loop that develops features end-to-end, with human supervision.",
    description:
      "The full architecture behind LTG OS: Cloudflare Workers as the orchestrator, GitHub as the gatekeeper, NoteIQ as the backlog. Covers the branch-creation / file-write / PR-creation loop, cost accounting, safety rails, and how to keep humans meaningfully in the loop.",
    price: "$49",
    audience: "Practitioners building agentic systems in production.",
    topics: ["AI Agents", "Cloudflare", "MCP", "LLMOps"],
    chapters: 14,
    pages: 220,
  },
  {
    slug: "msp-security-runbook",
    name: "MSP Security Runbook",
    kind: "playbook",
    status: "draft",
    tagline: "The 100 checks that separate a graded MSP from an audited one.",
    description:
      "A field guide to Microsoft 365, Entra ID, and Azure security posture assessments — pulled from real Storm-Hunter, Entra Sentinel, and DSPM engagements. Every check has why, how, and the fix.",
    price: "$79",
    audience: "MSP engineers, IT managers, and vCISOs.",
    topics: ["Entra ID", "M365", "DSPM", "Rapid7"],
  },
  {
    slug: "workiq-starter",
    name: "WorkIQ Starter Repo",
    kind: "template",
    status: "available",
    tagline: "The canonical WorkIQ scaffold — free.",
    description:
      "Everything the `create-workiq` generator emits, in a public repo. Bun runtime, Hono API with a synchronous driver-blind repo, Astro house console, Cloudflare wrangler config, a flock harness, and CI wired for canary deploys.",
    price: "Free",
    audience: "Developers who want to see the stack before committing to the book.",
    topics: ["Bun", "Hono", "Astro"],
    readUrl: "https://github.com/asdtransport",
  },
];
