/* J's Ournal offline worker.
   Network first for the app's own files, so every launch picks up the newest version;
   falls back to the saved copy when offline or when the network is slow.
   It never touches GitHub API calls (those are cross-origin and go straight to the network). */
const CACHE = "jsournal-app";
const SHELL = [
  "./", "index.html", "app.css", "app.js", "sync.js", "manifest.webmanifest",
  "apple-touch-icon.png", "icon-192.png", "icon-512.png", "favicon-32.png",
  "bricolage-grotesque-latin-600-normal.woff2", "bricolage-grotesque-latin-800-normal.woff2",
  "atkinson-hyperlegible-latin-400-normal.woff2", "atkinson-hyperlegible-latin-700-normal.woff2",
  "jetbrains-mono-latin-400-normal.woff2", "jetbrains-mono-latin-500-normal.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const strip = (url) => { const u = new URL(url); u.search = ""; return u.href; };

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === "navigate" ? new URL("index.html", self.registration.scope).href : strip(req.url);
    const network = fetch(req, { cache: "no-cache" }).then((res) => {
      if (res.ok && res.type === "basic") cache.put(key, res.clone());
      return res;
    });
    const fallback = new Promise((resolve) => setTimeout(async () => resolve(await cache.match(key)), 3500));
    try {
      const res = await Promise.race([network, fallback]);
      if (res) return res;
      return await network;
    } catch {
      const hit = await cache.match(key);
      if (hit) return hit;
      throw new Error("offline");
    }
  })());
});
