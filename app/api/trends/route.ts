import { NextResponse } from "next/server";
import { fetchGoogleTrendingRss } from "@/lib/googleTrends";
import { fetchTikTokCreativeCenterHashtags } from "@/lib/tiktokCreative";
import { fetchTikTokHashtagsViaApify } from "@/lib/tiktokApify";

export const runtime = "nodejs";

export async function GET() {
  try {
    const googleRssUrl =
      process.env.GOOGLE_TRENDS_RSS ??
      "https://trends.google.com/trending/rss?geo=US";

    const tiktokUrl =
      process.env.TIKTOK_CC_HASHTAGS ??
      "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en";

    // Preferred TikTok path on serverless: use Apify if configured (avoids TikTok JS-only HTML).
    const apifyToken = process.env.APIFY_TOKEN?.trim();
    const apifyActorId =
      (process.env.APIFY_ACTOR_ID ?? "lexis-solutions/tiktok-trending-hashtags-scraper").trim();

    const tiktokCountry = (process.env.TIKTOK_COUNTRY_CODE ?? "US").trim();
    const tiktokPeriod = (process.env.TIKTOK_PERIOD ?? "7").trim();
    const tiktokMaxItems = Number(process.env.TIKTOK_MAX_ITEMS ?? "100");
    const tiktokIndustry = (process.env.TIKTOK_INDUSTRY ?? "").trim();

    const googleP = fetchGoogleTrendingRss(googleRssUrl);

    const tiktokP = (async () => {
      if (apifyToken) {
        return await fetchTikTokHashtagsViaApify({
          token: apifyToken,
          actorId: apifyActorId,
          countryCode: tiktokCountry,
          period: tiktokPeriod,
          maxItems: Number.isFinite(tiktokMaxItems) ? tiktokMaxItems : 100,
          industry: tiktokIndustry || undefined,
        });
      }
      // fallback (often fails on serverless)
      return await fetchTikTokCreativeCenterHashtags(tiktokUrl);
    })();

    const [google, tiktok] = await Promise.allSettled([googleP, tiktokP]);

    const payload = {
      ok: true,
      fetchedAt: new Date().toISOString(),
      google: google.status === "fulfilled" ? google.value : [],
      tiktokHashtags: tiktok.status === "fulfilled" ? tiktok.value : [],
      errors: {
        google: google.status === "rejected" ? String(google.reason) : null,
        tiktok: tiktok.status === "rejected" ? String(tiktok.reason) : null,
      },
      tiktokProvider: apifyToken ? "apify" : "scrape",
    };

    return NextResponse.json(payload, {
      headers: {
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
