/* Agenda Pessoal — Service Worker (cache offline)
 * Coloque sw.js na MESMA pasta que agenda.html.
 * Safari iOS: exige HTTPS ou localhost (não funciona com file://).
 * Dados (XP, tarefas, foto) continuam em localStorage no app — não são cache do SW.
 */
var CACHE_NAME = 'agenda-offline-v2';
var FALLBACK_HTML = 'agenda.html';

self.addEventListener('install', function (event) {
  self.skipWaiting();
  var scope = self.registration.scope;
  var urls = [scope + FALLBACK_HTML, self.location.href];
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        urls.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
        })
      );
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

function wantsHtml(request) {
  return (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').indexOf('text/html') !== -1
  );
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  if (wantsHtml(request)) {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request.url, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (hit) {
            if (hit) return hit;
            var scope = self.registration.scope;
            return caches.match(scope + FALLBACK_HTML);
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      return (
        cached ||
        fetch(request)
          .then(function (response) {
            if (response && response.ok) {
              var copy = response.clone();
              caches.open(CACHE_NAME).then(function (cache) {
                cache.put(request, copy);
              });
            }
            return response;
          })
          .catch(function () {
            return cached;
          })
      );
    })
  );
});
