import Parser from "rss-parser";

export type GoogleTrendItem = {
  title: string;
  link?: string;
  pubDate?: string;
  approxTraffic?: string;
  description?: string;
};

export async function fetchGoogleTrendingRss(
  rssUrl: string
): Promise<GoogleTrendItem[]> {
  const parser: Parser<any, any> = new Parser({
    customFields: {
      item: [
        ["ht:approx_traffic", "approxTraffic"],
        ["approx_traffic", "approxTraffic"],
      ],
    },
  });

  const feed = await parser.parseURL(rssUrl);

  return (feed.items ?? [])
    .map((it: any) => ({
      title: (it.title ?? "").trim(),
      link: it.link,
      pubDate: it.pubDate,
      approxTraffic: it.approxTraffic ?? it["ht:approx_traffic"],
      description: it.contentSnippet ?? it.content ?? it.summary,
    }))
    .filter((x) => x.title.length > 0)
    .slice(0, 50);
}
