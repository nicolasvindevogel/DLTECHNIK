// DL TECHNIK V3.9.1 — installation sûre, aucun accès aux brouillons IndexedDB.
const CACHE='dl-technik-v3-9-1';
const CORE=['./','./index.html','./manifest.webmanifest','./dl-technik-logo.png',
  './icon-192.png','./icon-512.png','./icon-512-maskable.png',
  './apple-touch-icon.png','./favicon-32x32.png','./favicon-16x16.png'];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('dl-technik-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  // Never cache API calls; never interfere with write traffic or signatures.
  if(url.pathname.includes('/functions/v1/'))return;
  const sameOrigin=url.origin===self.location.origin;
  if(sameOrigin&&CORE.some(p=>new URL(p,self.registration.scope).href===url.href)){
    event.respondWith(caches.match(req).then(cached=>{
      const fresh=fetch(req).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(k=>k.put(req,c)).catch(()=>{})}return res}).catch(()=>null);
      return cached||fresh;
    }));return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(cached){
      event.waitUntil(fetch(req).then(res=>{if(res.ok||res.type==='opaque')return caches.open(CACHE).then(c=>c.put(req,res.clone()))}).catch(()=>{}));
      return cached;
    }
    try{
      const res=await fetch(req);
      if(res.ok||res.type==='opaque')event.waitUntil(caches.open(CACHE).then(c=>c.put(req,res.clone())).catch(()=>{}));
      return res;
    }catch(e){
      if(req.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
      return Response.error();
    }
  })());
});
