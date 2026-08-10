import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getAllPosts } from "../lib/content";

export async function GET(context: APIContext) {
  const posts = await getAllPosts();
  return rss({
    title: "Derek Ethan Davis",
    description: "Engineer and builder. Notes on AI agents, edge infrastructure, MSP tooling.",
    site: context.site!,
    items: posts.map(post => ({
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
