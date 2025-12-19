import * as cheerio from "cheerio";

export type TikTokHashtagTrend = {
  rank: number;
  hashtag: string; // without '#'
  postsText?: string; // e.g. "241K"
  rawText?: string; // full row text
  sourceUrl: string;
};

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export async function fetchTikTokCreativeCenterHashtags(
  url: string
): Promise<TikTokHashtagTrend[]> {
  const res = await fetch(url, {
    headers: {
      // Avoid looking like a bot (still respect ToS/robots and don’t spam requests).
      "User-Agent":
        "Mozilla/5.0 (compatible; TrendRadar/1.0; +https://example.local)",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`TikTok CC fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const rows: string[] = [];
  $("a").each((_, el) => {
    const t = normalizeSpaces($(el).text());
    // The page often contains anchor rows like:
    // "1 # missuniverse News & Entertainment 241K Posts"
    if (/^\d+\s+#\s*\S+/.test(t) && /\bPosts\b/i.test(t)) rows.push(t);
  });

  // Fallback: if anchors didn’t work, scan all text blocks
  if (rows.length === 0) {
    $("body *").each((_, el) => {
      const t = normalizeSpaces($(el).text());
      if (/^\d+\s+#\s*\S+/.test(t) && /\bPosts\b/i.test(t)) rows.push(t);
    });
  }

  const out: TikTokHashtagTrend[] = [];
  for (const t of rows) {
    // Parse rank + hashtag + posts
    const m = t.match(/^(\d+)\s+#\s*([A-Za-z0-9_\.]+)\b(.*)$/);
    if (!m) continue;

    const rank = Number(m[1]);
    const hashtag = m[2];

    // Find "241K Posts" / "6K Posts" etc.
    const postsMatch = t.match(/\b(\d+(?:\.\d+)?[KMB]?)\s+Posts\b/i);

    out.push({
      rank,
      hashtag,
      postsText: postsMatch?.[1],
      rawText: t,
      sourceUrl: url,
    });
  }

  // Deduplicate by hashtag, keep best (lowest rank)
  const byTag = new Map<string, TikTokHashtagTrend>();
  for (const item of out) {
    const prev = byTag.get(item.hashtag);
    if (!prev || item.rank < prev.rank) byTag.set(item.hashtag, item);
  }

  return Array.from(byTag.values())
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 100);
}
