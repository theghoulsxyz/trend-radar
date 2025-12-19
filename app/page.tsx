"use client";

import React, { useEffect, useMemo, useState } from "react";

type GoogleTrendItem = {
  title: string;
  link?: string;
  pubDate?: string;
  approxTraffic?: string;
  description?: string;
};

type TikTokHashtagTrend = {
  rank: number;
  hashtag: string;
  postsText?: string;
  rawText?: string;
  sourceUrl: string;
};

type ApiPayload = {
  ok: boolean;
  fetchedAt: string;
  google: GoogleTrendItem[];
  tiktokHashtags: TikTokHashtagTrend[];
  errors?: { google?: string | null; tiktok?: string | null };
};

function memeScore(text: string) {
  const s = text.toLowerCase();
  let score = 0;

  // Simple “meme-ish” heuristics (tweak as you like)
  if (s.includes("free ")) score += 2;
  if (s.includes("challenge")) score += 2;
  if (s.includes("meme")) score += 1;
  if (s.includes("sigma") || s.includes("rizz") || s.includes("brainrot")) score += 2;
  if (/\b(cat|dog|chips|bag|capybara|skibidi)\b/.test(s)) score += 1;
  if (/[0-9]/.test(s)) score += 1;
  if (text.length >= 8 && text.length <= 32) score += 1;
  if (text.split(" ").length >= 2 && text.split(" ").length <= 6) score += 1;

  return score;
}

export default function Page() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"google" | "tiktok">("google");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/trends", { cache: "no-store" });
      const json = (await res.json()) as ApiPayload;
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredGoogle = useMemo(() => {
    const list = data?.google ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;

    return list.filter((x) => (x.title ?? "").toLowerCase().includes(needle));
  }, [data, q]);

  const filteredTikTok = useMemo(() => {
    const list = data?.tiktokHashtags ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;

    return list.filter((x) => x.hashtag.toLowerCase().includes(needle));
  }, [data, q]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 20, fontFamily: "system-ui, Arial" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Trend Radar</h1>
          <div style={{ opacity: 0.7, marginTop: 4 }}>
            Google trending searches + TikTok Creative Center hashtags (for meme scouting)
          </div>
          {data?.fetchedAt && (
            <div style={{ opacity: 0.7, marginTop: 4, fontSize: 12 }}>
              Last fetch: {new Date(data.fetchedAt).toLocaleString()}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.2)",
              minWidth: 260,
            }}
          />
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.2)",
              cursor: "pointer",
            }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <section style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          onClick={() => setTab("google")}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.2)",
            cursor: "pointer",
            background: tab === "google" ? "rgba(0,0,0,0.08)" : "transparent",
          }}
        >
          Google Trends
        </button>
        <button
          onClick={() => setTab("tiktok")}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.2)",
            cursor: "pointer",
            background: tab === "tiktok" ? "rgba(0,0,0,0.08)" : "transparent",
          }}
        >
          TikTok Hashtags
        </button>
      </section>

      {data?.errors && (data.errors.google || data.errors.tiktok) && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,0,0,0.25)" }}>
          <b>Some sources failed:</b>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            {data.errors.google ? <div>Google: {data.errors.google}</div> : null}
            {data.errors.tiktok ? <div>TikTok: {data.errors.tiktok}</div> : null}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {tab === "google" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {filteredGoogle.map((t, idx) => {
              const score = memeScore(t.title);
              return (
                <div key={idx} style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(0,0,0,0.15)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <b style={{ fontSize: 16 }}>{t.title}</b>
                    <span title="Meme-likelihood score" style={{ opacity: 0.7 }}>
                      🔥 {score}
                    </span>
                  </div>
                  <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
                    {t.approxTraffic ? <span>Traffic: {t.approxTraffic} · </span> : null}
                    {t.pubDate ? <span>{new Date(t.pubDate).toLocaleString()}</span> : null}
                  </div>
                  {t.link ? (
                    <div style={{ marginTop: 10 }}>
                      <a href={t.link} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {filteredTikTok.map((t) => {
              const score = memeScore(t.hashtag);
              return (
                <div key={t.hashtag} style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(0,0,0,0.15)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <b style={{ fontSize: 16 }}>#{t.hashtag}</b>
                    <span style={{ opacity: 0.7 }}>🔥 {score}</span>
                  </div>
                  <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
                    Rank: {t.rank}
                    {t.postsText ? ` · Posts: ${t.postsText}` : ""}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <a href={t.sourceUrl} target="_blank" rel="noreferrer">
                      Open source page
                    </a>
                  </div>
                  {t.rawText ? (
                    <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>{t.rawText}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
