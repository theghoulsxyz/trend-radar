import { NextResponse } from "next/server";
import { fetchGoogleTrendingRss } from "@/lib/googleTrends";
import { fetchTikTokCreativeCenterHashtags } from "@/lib/tiktokCreative";

export const runtime = "nodejs"; // cheerio + rss parsing on server

export async function GET() {
  try {
    const googleRssUrl =
      process.env.GOOGLE_TRENDS_RSS ??
      "https://trends.google.com/trending/rss?geo=US";

    const tiktokUrl =
      process.env.TIKTOK_CC_HASHTAGS ??
      "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en";

    const [google, tiktok] = await Promise.allSettled([
      fetchGoogleTrendingRss(googleRssUrl),
      fetchTikTokCreativeCenterHashtags(tiktokUrl),
    ]);

    const payload = {
      ok: true,
      fetchedAt: new Date().toISOString(),
      google: google.status === "fulfilled" ? google.value : [],
      tiktokHashtags: tiktok.status === "fulfilled" ? tiktok.value : [],
      errors: {
        google: google.status === "rejected" ? String(google.reason) : null,
        tiktok: tiktok.status === "rejected" ? String(tiktok.reason) : null,
      },
    };

    return NextResponse.json(payload, {
      headers: {
        // light caching so you don’t hammer sources on refresh
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
