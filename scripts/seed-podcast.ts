#!/usr/bin/env bun
/**
 * Seed the first episode(s) of the `dedwrong` podcast.
 * Idempotent — createOrReplace with deterministic _id.
 */
import { createClient } from "@sanity/client";

const PROJECT_ID = process.env.SANITY_PROJECT_ID!;
const TOKEN      = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_TOKEN!;

const client = createClient({
  projectId: PROJECT_ID,
  dataset: "production",
  apiVersion: "2024-01-01",
  token: TOKEN,
  useCdn: false,
});

let ctr = 0;
const k = () => `k${(++ctr).toString(36).padStart(6, "0")}`;
const p = (text: string) => ({
  _type: "block", _key: k(), style: "normal",
  children: [{ _type: "span", _key: k(), text, marks: [] }],
});
const h2 = (text: string) => ({
  _type: "block", _key: k(), style: "h2",
  children: [{ _type: "span", _key: k(), text, marks: [] }],
});
const li = (text: string) => ({
  _type: "block", _key: k(), style: "normal", listItem: "bullet", level: 1,
  children: [{ _type: "span", _key: k(), text, marks: [] }],
});

async function main() {
  const authorRef = "author.derek";

  // Episode #0 — introduction
  await client.createOrReplace({
    _id: "episode.welcome",
    _type: "episode",
    number: 0,
    title: "Welcome to dedwrong",
    slug: { _type: "slug", current: "welcome" },
    tagline: "Why I'm starting a podcast about the ways I've been dead wrong.",
    description: "A five-minute intro to dedwrong — what it is, why it exists, and what I'm hoping to do with it. TL;DR: engineering that ships in the real world involves being wrong all the time. Here's a place to talk about that honestly.",
    audioUrl: "", // Add after recording
    audioBytes: 0,
    durationSeconds: 300,
    publishedDate: new Date().toISOString(),
    kind: "trailer",
    season: 1,
    explicit: false,
    tags: ["intro", "meta"],
    showNotes: [
      p("dedwrong is a podcast about production engineering — the specific kind of engineering where a real system serves real users and a real bill gets paid at the end of the month."),
      p("Most engineering content pretends the process is clean. Blog post → shipped. Diagram → deployed. Reality is that between the diagram and production there are two weeks of being wrong about things, some of them public. This podcast is the honest version."),
      h2("What to expect"),
      li("15-45 minute episodes, roughly weekly"),
      li("Real production mistakes I've made and what I learned"),
      li("Deep-dives on the WorkIQ stack, AI agent systems, edge infrastructure, MSP operations"),
      li("Occasional guests — engineers, builders, people I disagree with"),
      h2("Why 'dedwrong'"),
      p("Derek Ethan Davis = DED. Dead wrong. The name should tell you something about the tone: I'm not here to teach you how I got it right. I'm here to talk about how I got it wrong, publicly, and what I did next."),
      h2("Where to listen"),
      p("Everywhere podcasts live — Apple, Spotify, YouTube, the RSS feed on this page. Subscribe once and every new episode arrives automatically."),
    ],
    chapters: [
      { _key: k(), timestamp: "00:00", title: "Cold open" },
      { _key: k(), timestamp: "00:45", title: "What dedwrong is" },
      { _key: k(), timestamp: "02:30", title: "Why the name" },
      { _key: k(), timestamp: "03:45", title: "What to expect" },
      { _key: k(), timestamp: "04:30", title: "Where to listen" },
    ],
    draft: false,
  });
  console.log("✓ episode #0 — Welcome to dedwrong");

  // Episode #1 — placeholder, in-progress
  await client.createOrReplace({
    _id: "episode.ep1-workiq",
    _type: "episode",
    number: 1,
    title: "How I got the WorkIQ stack dead wrong for six months",
    slug: { _type: "slug", current: "workiq-stack-dead-wrong" },
    tagline: "Postgres, containers, and the two years I spent refusing to trust Cloudflare.",
    description: "Every WorkIQ app now runs on Bun · Hono · Astro · Cloudflare. It didn't start that way. This episode walks through the six months I spent building on Postgres in a Docker container in Fly.io, why I fought against the edge, and what finally made me switch.",
    audioUrl: "",
    audioBytes: 0,
    durationSeconds: 2280, // 38 minutes
    publishedDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    kind: "full",
    season: 1,
    explicit: false,
    tags: ["WorkIQ", "Cloudflare", "architecture", "postmortem"],
    showNotes: [
      p("A postmortem on my own architectural choices, told from the perspective of eighteen months later. This episode is what I would tell 2024-me if I could go back and hand him the notes."),
    ],
    chapters: [
      { _key: k(), timestamp: "00:00", title: "The setup" },
      { _key: k(), timestamp: "04:15", title: "Why I chose Postgres + Fly" },
      { _key: k(), timestamp: "12:30", title: "The first crack — a two-hour incident" },
      { _key: k(), timestamp: "22:00", title: "Trying Durable Objects for the first time" },
      { _key: k(), timestamp: "31:45", title: "What I'd tell 2024-me" },
      { _key: k(), timestamp: "36:00", title: "Outro" },
    ],
    draft: true, // upcoming
  });
  console.log("✓ episode #1 — WorkIQ stack dead wrong (draft, upcoming)");

  console.log("\ndone.");
}

main().catch(e => { console.error(e); process.exit(1); });
