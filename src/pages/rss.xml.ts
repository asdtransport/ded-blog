import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return rss({
    title: "Derek Ethan Davis",
    description: "Engineer and builder. Notes on AI agents, edge infrastructure, MSP tooling.",
    site: context.site!,
    items: posts
      .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime())
      .map(post => ({
        title: post.data.title,
        pubDate: post.data.pubDate,
        description: post.data.description,
        link: `/blog/${post.slug}`,
        author: post.data.author,
        categories: post.data.tags,
      })),
    customData: `<language>en-us</language>`,
  });
}
