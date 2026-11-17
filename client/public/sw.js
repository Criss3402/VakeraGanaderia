const CACHE_SHELL = "vakera-shell-v1";
const CACHE_API = "vakera-api-v1";

const RECURSOS_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/hero-bg.webp",
  "/logo-vakera.png",
  "/icono-chat.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(RECURSOS_SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter((k) => k !== CACHE_SHELL && k !== CACHE_API)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Peticiones de API GET: Network-first con respaldo en caché para lectura sin señal (Modo Rural)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && !url.pathname.startsWith("/api/auth/")) {
            const copia = response.clone();
            caches.open(CACHE_API).then((cache) => cache.put(request, copia));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ ok: false, error: "Sin conexión a internet (Modo Rural)." }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          );
        })
    );
    return;
  }

  // Activos estáticos (JS, CSS, imágenes): Cache-first con actualización en segundo plano
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copia = response.clone();
            caches.open(CACHE_SHELL).then((cache) => cache.put(request, copia));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
