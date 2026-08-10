import { getCollection } from "astro:content";
import type { APIContext } from "astro";

// llms-full.txt — full post text concatenated, for AI ingestion in a single fetch.
// Strips MDX/JSX to leave readable prose + code fences.

function stripMdx(md: string): string {
  return md
    .replace(/^---[\s\S]*?---\n/, "")             // strip frontmatter
    .replace(/^import .*$/gm, "")                  // strip imports
    .replace(/<[A-Z][^>]*\/>/g, "")                // self-closing components
    .replace(/<[A-Z][^>]*>[\s\S]*?<\/[A-Z][^>]*>/g, "") // component blocks
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(context: APIContext) {
  const site = context.site!.toString().replace(/\/$/, "");
  const posts = (await getCollection("blog", ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  const parts = [
    `# Derek Ethan Davis — full blog contents`,
    `Site: ${site}`,
    `Author: Derek Ethan Davis`,
    ``,
    `---`,
    ``,
  ];

  for (const p of posts) {
    parts.push(`# ${p.data.title}`);
    parts.push(``);
    parts.push(`URL: ${site}/blog/${p.slug}`);
    parts.push(`Published: ${p.data.pubDate.toISOString().slice(0, 10)}`);
    if (p.data.tldr) parts.push(`TL;DR: ${p.data.tldr}`);
    parts.push(``);
    parts.push(stripMdx(p.body));
    parts.push(``);
    parts.push(`---`);
    parts.push(``);
  }

  return new Response(parts.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
