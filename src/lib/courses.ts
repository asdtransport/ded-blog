/**
 * Courses config — sellable, structured learning. Rendered by /courses.
 *
 * Migration path: replace with a Sanity `course` schema when you're ready.
 * Same shape → no route changes needed.
 */

export type CourseStatus = "available" | "cohort-open" | "waitlist" | "coming-soon";

export interface Course {
  slug: string;
  title: string;
  status: CourseStatus;
  format: "self-paced" | "cohort" | "workshop";
  tagline: string;
  description: string;
  duration?: string;             // "6 weeks" | "2 half-days"
  price?: string;                // display price
  buyUrl?: string;               // Podia / Teachable / Gumroad / Stripe checkout
  waitlistUrl?: string;
  outcomes: string[];            // 3-5 bullet outcomes
  modules?: number;
  hours?: number;
  prereqs?: string;              // one-liner
  audience: string;              // one-liner
}

export const courses: Course[] = [
  {
    slug: "edge-native-saas",
    title: "Edge-Native SaaS on Cloudflare",
    status: "waitlist",
    format: "cohort",
    tagline: "Ship a real product on Bun · Hono · Astro · Cloudflare in six weeks, no fluff.",
    description:
      "A cohort-based course for engineers who want to stop wiring servers and start shipping on the edge. Build an actual paid SaaS end-to-end: auth (Entra + magic links), data (Durable Object SQLite), UI (Astro house console), billing (Stripe), analytics, and ops. You leave with something real, deployed, and revenue-capable.",
    duration: "6 weeks",
    price: "$1,200",
    outcomes: [
      "A deployed WorkIQ app you own, on your own domain, behind Cloudflare Access",
      "A working Stripe billing loop with trials, upgrades, and dunning",
      "A CI/CD setup with canary deploys and rollbacks",
      "The mental model to keep shipping after the cohort ends",
    ],
    modules: 12,
    hours: 40,
    prereqs: "TypeScript comfortable. Zero Cloudflare knowledge required.",
    audience: "Engineers building side-projects or internal tools who want to ship faster.",
  },
  {
    slug: "agent-systems-workshop",
    title: "Agent Systems in Production",
    status: "coming-soon",
    format: "workshop",
    tagline: "The two-day workshop version of the Agent Systems book.",
    description:
      "Live, hands-on session covering the LTG OS architecture. We build an autonomous agent loop from empty repo to first successful PR, with human supervision. Small groups (max 10), heavy on writing code, light on slides.",
    duration: "2 half-days",
    price: "$600",
    outcomes: [
      "A working agent that can plan → branch → edit → PR against a real repo",
      "Cost telemetry hooked into a dashboard",
      "Safety rails: gates, review flows, rollback",
      "A written run-of-show for your team",
    ],
    modules: 6,
    hours: 8,
    prereqs: "Comfortable calling an LLM API. Familiarity with GitHub.",
    audience: "Engineering leads exploring agentic workflows for their team.",
  },
  {
    slug: "msp-modernization",
    title: "MSP Modernization Track",
    status: "coming-soon",
    format: "self-paced",
    tagline: "Turn a legacy MSP stack into a graded, agent-ready operation.",
    description:
      "Self-paced course pulling from real Lockstep + OCG integration work. Covers M365 / Entra migrations, ConnectWise reconciliation, DSPM, Storm-Hunter TTP hunting, and how to fold AI agents into a mature MSP without breaking the boat.",
    duration: "self-paced",
    price: "$350",
    outcomes: [
      "A DSPM baseline for your tenant, scored and remediation-ranked",
      "A ConnectWise → agent pipeline for renewals and reconciliation",
      "An Entra + Intune posture that would pass a client audit",
    ],
    modules: 18,
    hours: 24,
    prereqs: "Working knowledge of M365 and ConnectWise.",
    audience: "MSP engineers and IT managers modernizing operations.",
  },
];
