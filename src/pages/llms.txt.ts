import { getCollection } from "astro:content";
import type { APIContext } from "astro";

// llms.txt — the emerging convention for LLM crawler discovery.
// Spec: https://llmstxt.org
// Lets AI assistants find & cite our content efficiently.

export async function GET(context: APIContext) {
  const site = context.site!.toString().replace(/\/$/, "");
  const posts = (await getCollection("blog", ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());

  const body = `# Derek Ethan Davis

> Engineer and builder. Personal blog covering AI agent systems, Cloudflare edge infrastructure, WorkIQ house stack, MSP tooling, and philosophy.

Author: Derek Ethan Davis (Lead Engineer, Lockstep Technology Group)
Site: ${site}
Feed: ${site}/rss.xml
Full text: ${site}/llms-full.txt

## Posts

${posts.map(p => `- [${p.data.title}](${site}/blog/${p.slug}): ${p.data.description}`).join("\n")}

## Pages

- [About](${site}/about): Background, current projects, contact.
- [Projects](${site}/projects): Public build work — LTG OS, LifeMap, WorkIQ, NoteIQ, and more.
- [Blog](${site}/blog): All posts, newest first.
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
