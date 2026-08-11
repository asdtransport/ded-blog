import type { APIContext } from "astro";
import { getAllEpisodes } from "../../lib/content";

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const fmtDuration = (seconds: number | undefined) => {
  if (!seconds) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export async function GET(context: APIContext) {
  const site = context.site!.toString().replace(/\/$/, "");
  const episodes = await getAllEpisodes(false);   // only published

  const showTitle = "dedwrong";
  const showDesc = "A podcast about the ways I've been dead wrong in production. AI agents, edge infrastructure, MSP work, and the specific mistakes I keep making.";
  const author = "Derek Ethan Davis";
  const email = "derek@lockstep.tech";
  const artwork = `${site}/dedwrong-artwork.jpg`;
  const feedUrl = `${site}/dedwrong/rss.xml`;

  const items = episodes.map(ep => {
    const link = `${site}/dedwrong/${ep.slug}`;
    const enclosure = ep.audioUrl
      ? `<enclosure url="${escapeXml(ep.audioUrl)}" type="audio/mpeg" length="${ep.audioBytes || 0}" />`
      : "";
    return `
    <item>
      <title>${escapeXml(`#${ep.number} — ${ep.title}`)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${ep.publishedDate.toUTCString()}</pubDate>
      <description><![CDATA[${ep.tagline || ep.description}]]></description>
      <content:encoded><![CDATA[${ep.showNotesHtml}]]></content:encoded>
      ${enclosure}
      <itunes:title>${escapeXml(ep.title)}</itunes:title>
      <itunes:episode>${ep.number}</itunes:episode>
      <itunes:season>${ep.season}</itunes:season>
      <itunes:episodeType>${ep.kind}</itunes:episodeType>
      <itunes:duration>${fmtDuration(ep.durationSeconds)}</itunes:duration>
      <itunes:explicit>${ep.explicit ? "true" : "false"}</itunes:explicit>
      <itunes:author>${escapeXml(author)}</itunes:author>
      <itunes:summary><![CDATA[${ep.description}]]></itunes:summary>
      ${ep.cover ? `<itunes:image href="${escapeXml(ep.cover)}" />` : ""}
    </item>`;
  }).join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <title>${escapeXml(showTitle)}</title>
    <link>${site}/dedwrong</link>
    <description><![CDATA[${showDesc}]]></description>
    <language>en-us</language>
    <copyright>© ${new Date().getFullYear()} ${escapeXml(author)}</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <itunes:author>${escapeXml(author)}</itunes:author>
    <itunes:summary><![CDATA[${showDesc}]]></itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>${escapeXml(author)}</itunes:name>
      <itunes:email>${email}</itunes:email>
    </itunes:owner>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="Technology" />
    <itunes:category text="Business">
      <itunes:category text="Entrepreneurship" />
    </itunes:category>
    <itunes:image href="${artwork}" />
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
