import * as cheerio from "cheerio";

export type TikTokHashtagTrend = {
  rank: number;
  hashtag: string; // without '#'
  postsText?: string; // e.g. "351K"
  rawText?: string; // matched snippet
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

function parseHashtagsFromText(scanText: string, sourceUrl: string): TikTokHashtagTrend[] {
  // Matches both formats:
  //  - "1 # livewithlessfollowers 351K Posts"
  //  - "3 3 # fnaf2 Games 85K Posts" (rank + delta + #tag)
  //
  // Also tolerant to extra columns like industry names between tag and "Posts".
  const re =
    /\b(\d{1,3})\s+(?:[-+]?\d{1,3}\s+)?#\s*([^\s#]{1,80})\b[\s\S]{0,220}?\b(\d+(?:\.\d+)?[KMB]?)\s+Post(?:s)?\b/gi;

  const out: TikTokHashtagTrend[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(scanText)) !== null) {
    const rank = Number(m[1]);
    const hashtag = m[2];
    const postsText = m[3];
    const rawText = normalizeSpaces(m[0]);

    if (!Number.isFinite(rank) || !hashtag) continue;

    out.push({
      rank,
      hashtag,
      postsText,
      rawText,
      sourceUrl,
    });
  }

  // Deduplicate by hashtag, keep best (lowest rank)
  const byTag = new Map<string, TikTokHashtagTrend>();
  for (const item of out) {
    const prev = byTag.get(item.hashtag);
    if (!prev || item.rank < prev.rank) byTag.set(item.hashtag, item);
  }

  return Array.from(byTag.values()).sort((a, b) => a.rank - b.rank);
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://ads.tiktok.com/",
    },
    cache: "no-store",
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`TikTok CC fetch failed: ${res.status} ${res.statusText}`);
  }

  return await res.text();
}

export async function fetchTikTokCreativeCenterHashtags(
  url: string
): Promise<TikTokHashtagTrend[]> {
  // TikTok sometimes serves different HTML (or JS-only shells) depending on region/serverless IP.
  // We try multiple endpoints (PC + Mobile) and return the first one that parses successfully.
  const candidates = [
    url,
    "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en",
    "https://ads.tiktok.com/business/creativecenter/mobile/en",
  ].filter(Boolean);

  let lastError: string | null = null;

  for (const candidate of candidates) {
    try {
      const html = await fetchHtml(candidate);
      const $ = cheerio.load(html);

      const bodyText = normalizeSpaces($("body").text());
      if (looksBlocked(bodyText)) {
        lastError = "TikTok Creative Center blocked this request (bot/security page).";
        continue;
      }

      // Combine body text + anchor texts for maximum chance of matching
      const anchorText = normalizeSpaces(
        $("a")
          .map((_, el) => $(el).text())
          .get()
          .join(" ")
      );

      const combined = `${bodyText} ${anchorText}`;

      const parsed = parseHashtagsFromText(combined, candidate);

      if (parsed.length > 0) {
        // keep top 100
        return parsed.slice(0, 100);
      }

      lastError = "Fetched TikTok page but parsed 0 hashtags (HTML may be different / JS-only).";
    } catch (e: any) {
      lastError = e?.message ?? String(e);
    }
  }

  throw new Error(lastError ?? "TikTok source failed.");
}
