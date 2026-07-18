/* Service worker — Guia Gramado 2026
   Estratégia:
   - index.html (navegação): rede primeiro, cache como fallback (offline na serra)
   - demais GETs (fontes, Leaflet, ícones): cache primeiro, atualizando em segundo plano
   - tiles do mapa e API de clima: sempre rede (não cachear — volume alto / dado vivo) */
const CACHE = "gramado26-v1";
const CORE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.hostname.includes("cartocdn") || url.hostname.includes("openstreetmap") || url.hostname.includes("open-meteo")) return;

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put("./index.html", cp));
          return r;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request)
        .then(r => {
          if (r.ok) {
            const cp = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, cp));
          }
          return r;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
