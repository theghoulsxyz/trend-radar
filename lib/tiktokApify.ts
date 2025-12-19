export type TikTokHashtagTrend = {
  rank: number;
  hashtag: string; // without '#'
  postsText?: string; // we show publish count if available
  rawText?: string; // debug/extra fields if available
  sourceUrl: string;
};

function toApiActorId(actorId: string) {
  // Apify API uses "username~actor-name" (tilde). Store pages often show "username/actor-name".
  return actorId.includes("~") ? actorId : actorId.replace("/", "~");
}

function fmtCompact(n: number) {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export async function fetchTikTokHashtagsViaApify(opts: {
  token: string;
  actorId: string;
  countryCode?: string; // e.g. US, GB, TR
  period?: string; // "7" | "30" | ...
  maxItems?: number;
  industry?: string; // optional industry id
}): Promise<TikTokHashtagTrend[]> {
  const actorId = toApiActorId(opts.actorId);
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(
    actorId
  )}/run-sync-get-dataset-items?token=${encodeURIComponent(opts.token)}&format=json&clean=true`;

  // This actor (lexis-solutions/tiktok-trending-hashtags-scraper) accepts input like:
  // { countryCode: "TR", maxItems: 100, period: "7", industry: "..." }
  const input: any = {
    countryCode: (opts.countryCode ?? "US").toUpperCase(),
    maxItems: opts.maxItems ?? 100,
    period: String(opts.period ?? "7"),
  };
  if (opts.industry) input.industry = opts.industry;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apify TikTok fetch failed: ${res.status} ${res.statusText}${txt ? ` — ${txt.slice(0, 200)}` : ""}`);
  }

  const items = (await res.json()) as any[];

  // Map to our UI format (keep it tolerant)
  const out: TikTokHashtagTrend[] = (items ?? [])
    .map((it: any) => {
      const hashtag = String(it?.hashtag_name ?? it?.hashtag ?? it?.name ?? "").replace(/^#/, "").trim();
      const rank = Number(it?.rank ?? it?.position ?? 0);
      const publishCnt = it?.publish_cnt ?? it?.public_posts_count ?? it?.posts ?? null;
      const views = it?.video_views ?? it?.views ?? null;

      const postsText =
        publishCnt != null ? fmtCompact(Number(publishCnt)) :
        views != null ? fmtCompact(Number(views)) :
        undefined;

      // Put a compact debug string (optional)
      const rawTextParts: string[] = [];
      if (publishCnt != null) rawTextParts.push(`publish_cnt=${publishCnt}`);
      if (views != null) rawTextParts.push(`views=${views}`);
      if (it?.rank_diff_type != null) rawTextParts.push(`rank_diff_type=${it.rank_diff_type}`);

      return {
        rank: Number.isFinite(rank) ? rank : 0,
        hashtag,
        postsText,
        rawText: rawTextParts.length ? rawTextParts.join(" · ") : undefined,
        sourceUrl: "https://apify.com/" + opts.actorId.replace("~", "/"),
      };
    })
    .filter((x) => x.hashtag.length > 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 100);

  if (out.length === 0) {
    throw new Error("Apify returned 0 hashtags (check actor settings, countryCode, or plan limits).");
  }

  return out;
}
