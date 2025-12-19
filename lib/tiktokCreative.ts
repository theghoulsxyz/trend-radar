import * as cheerio from "cheerio";

export type TikTokHashtagTrend = {
  rank: number;
  hashtag: string; // without '#'
  postsText?: string; // e.g. "351K"
  rawText?: string; // the matched row text
  sourceUrl: string;
};

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function looksBlocked(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("access denied") ||
    t.includes("forbidden") ||
    t.includes("captcha") ||
    t.includes("verify you are") ||
    t.includes("unusual traffic") ||
    t.includes("enable javascript") ||
    t.includes("robot") ||
    t.includes("security check")
  );
}

export async function fetchTikTokCreativeCenterHashtags(
  url: string
): Promise<TikTokHashtagTrend[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://ads.tiktok.com/",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`TikTok CC fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const bodyText = normalizeSpaces($("body").text());

  // If TikTok served a block/challenge page, surface a clear error
  if (looksBlocked(bodyText)) {
    throw new Error(
      "TikTok Creative Center blocked this request (bot/security page). Try redeploying, changing region URL, or using an official/third-party API source."
    );
  }

  // Focus the scan after the table header to avoid random hashtag matches
  const headerIdx = bodyText.toLowerCase().indexOf("rank hashtags posts");
  const scanText = headerIdx >= 0 ? bodyText.slice(headerIdx) : bodyText;

  // Match both formats:
  //  - "1 # livewithlessfollowers 351K Posts"
  //  - "3 3 # fnaf2 Games 85K Posts"  (rank + delta + #tag)
  // Delta can also be negative in some views, so allow [-+]?
  const re =
    /\b(\d{1,3})\s+(?:[-+]?\d{1,3}\s+)?#\s*([^\s#]{1,60})\b([\s\S]{0,120}?)\b(\d+(?:\.\d+)?[KMB]?)\s+Posts\b/gi;

  const out: TikTokHashtagTrend[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(scanText)) !== null) {
    const rank = Number(m[1]);
    const hashtag = m[2];
    const postsText = m[4];
    const rawText = normalizeSpaces(m[0]);

    if (!Number.isFinite(rank) || !hashtag) continue;

    out.push({
      rank,
      hashtag,
      postsText,
      rawText,
      sourceUrl: url,
    });
  }

  // Deduplicate by hashtag, keep best (lowest rank)
  const byTag = new Map<string, TikTokHashtagTrend>();
  for (const item of out) {
    const prev = byTag.get(item.hashtag);
    if (!prev || item.rank < prev.rank) byTag.set(item.hashtag, item);
  }

  const finalList = Array.from(byTag.values()).sort((a, b) => a.rank - b.rank).slice(0, 100);

  // If we got HTML but parsed nothing, fail loudly so UI shows the error box
  if (finalList.length === 0) {
    throw new Error(
      "TikTok Creative Center page fetched but no hashtags were parsed. The HTML structure likely changed or content is being served differently in your deploy region."
    );
  }

  return finalList;
}
