const CACHE = "kisan-netra-v2";
const ASSETS = [
  "/",
  "/static/css/styles.css",
  "/static/js/app.js",
  "/manifest.webmanifest"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE && caches.delete(k)))));
});
self.addEventListener("fetch", (e)=>{
  const url = new URL(e.request.url);
  if (url.origin === location.origin){
    e.respondWith(
      caches.match(e.request).then(resp => resp || fetch(e.request).then(r=>{
        const copy = r.clone();
        caches.open(CACHE).then(c=>c.put(e.request, copy));
        return r;
      }).catch(()=> caches.match("/")))
    );
  }
});
