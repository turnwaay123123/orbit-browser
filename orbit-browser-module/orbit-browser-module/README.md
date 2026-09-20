# Orbit Browser Module — standalone preview

This is the standalone Orbit browser module. It has **not** been inserted into the main website yet.

## Included in this version

- Orbit branding on the New Tab page
- `by turnaway` retained on the home/New Tab screen
- Updates note: **previously known as deltamathhelp**
- DuckDuckGo as the default search engine
- Top-left browser controls:
  - Back
  - Forward
  - Refresh
  - Home / New Tab
- Fullscreen button ready for later embedding
- New Tab quick links:
  - Discord
  - Instagram
  - TikTok
  - YouTube
  - Reddit
  - Spotify
- Proxy engine selector:
  - Scramjet
  - Ultraviolet
- Transport selector:
  - Epoxy
  - libcurl
- Search engine selector:
  - DuckDuckGo
  - Google
  - Bing
- Wisp endpoint at `/wisp/`
- Shared root service worker for Scramjet and Ultraviolet
- Persistent Orbit browser settings through `localStorage`

## Run locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:8080
```

For a real deployment, use HTTPS and hosting that supports WebSocket upgrades because Wisp uses WebSockets.

## Integration later

When this module is approved, it can replace the current proxy iframe inside the main website. The parent iframe should include `allowfullscreen`. Orbit also emits an `orbit:request-fullscreen` postMessage fallback for the parent page to handle if nested fullscreen is blocked.
