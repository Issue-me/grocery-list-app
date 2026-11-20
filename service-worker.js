const CACHE='fiji-grocery-v18';
const SUPABASE_SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.1';
const FILES=['./','./index.html','./styles.css','./app.js','./supabase.js','./manifest.webmanifest','./icon.svg', './ux.css','./ux.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{await cache.addAll(FILES);try{const response=await fetch(SUPABASE_SDK,{mode:'cors'});if(response.ok)await cache.put(SUPABASE_SDK,response)}catch{}})));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const url=new URL(event.request.url);if(response.ok&&(url.origin===location.origin||url.href===SUPABASE_SDK)){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):Response.error())))});
