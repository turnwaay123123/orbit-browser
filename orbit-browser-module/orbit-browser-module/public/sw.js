// One root service worker can route requests to either engine.
importScripts("/scram/scramjet.all.js");
importScripts("/uv/uv.bundle.js");
importScripts("/uv.config.js");
importScripts("/uv/uv.sw.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
const ultraviolet = new UVServiceWorker();

self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    try {
      await scramjet.loadConfig();
      if (scramjet.route(event)) return scramjet.fetch(event);

      const requestUrl = new URL(event.request.url);
      if (requestUrl.pathname.startsWith(__uv$config.prefix)) {
        return ultraviolet.fetch(event);
      }
    } catch (error) {
      console.error("Proxy service worker error", error);
    }

    return fetch(event.request);
  })());
});
