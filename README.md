# Trend Radar (Google + TikTok Trend Monitor)

A tiny web app that aggregates:
- **Google Trends** "Trending searches" via **RSS**
- **TikTok Creative Center** trending **hashtags** (public page parse)

> Notes:
> - TikTok may block/limit automated requests. If the TikTok section shows errors, it's usually due to bot protections.
> - This is intended for **personal trend discovery** and monitoring public signals.

## 1) Setup

```bash
npm install
cp .env.example .env.local
```

## 2) Run locally

```bash
npm run dev
```
Open http://localhost:3000

## 3) Deploy

### Vercel
- Import the repo
- Add env vars from `.env.example`
- Deploy (Next.js is supported out of the box)

### Netlify
- Import the repo
- Add env vars from `.env.example`
- Netlify will use `@netlify/plugin-nextjs` (see `netlify.toml`)
- Build command: `npm run build`

## Customize
- Change regions by editing `GOOGLE_TRENDS_RSS` (e.g. geo=GB, geo=BG, geo=DE)
- Change TikTok region/language by adjusting the Creative Center URL.

## TikTok not working on Netlify/Vercel?
TikTok Creative Center often serves **JS-only HTML** to serverless IPs, which breaks scraping.
The easiest reliable fix is using **Apify** (set `APIFY_TOKEN`).

In `.env.local` (or Netlify env vars) set:
- `APIFY_TOKEN` (from Apify)
- `APIFY_ACTOR_ID=lexis-solutions/tiktok-trending-hashtags-scraper`
- `TIKTOK_COUNTRY_CODE=US` (or BG/TR/etc)
- `TIKTOK_PERIOD=7`
- `TIKTOK_MAX_ITEMS=100`

The app will automatically switch TikTok provider to Apify when `APIFY_TOKEN` is present.
