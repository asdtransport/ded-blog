import type { APIContext } from "astro";
import { getAllPosts } from "../lib/content";

function stripHtml(html: string): string {
  return html
    .replace(/<code>([\s\S]*?)<\/code>/g, "`$1`")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(context: APIContext) {
  const site = context.site!.toString().replace(/\/$/, "");
  const posts = await getAllPosts();

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
    parts.push(p.bodyHtml ? stripHtml(p.bodyHtml) : `[full text at ${site}/blog/${p.slug}]`);
    parts.push(``);
    parts.push(`---`);
    parts.push(``);
  }

  return new Response(parts.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
