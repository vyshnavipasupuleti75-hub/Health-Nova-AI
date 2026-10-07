/* HealthNova service worker: Web Push notifications only. It has no fetch handler, so it never caches or
   intercepts app requests. */

const ICON = '/notification-icon.png';
const BADGE = '/notification-badge.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Only same-origin app paths may be opened from a notification.
function safePath(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/dashboard';
}

async function windowClients() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = {}; }

    // "Report ready" is only useful when HealthNova is not the tab the user is looking at.
    if (data.onlyWhenHidden) {
      const clients = await windowClients();
      if (clients.some((client) => client.visibilityState === 'visible' && client.focused)) return;
    }

    // A fixed tag per kind means a repeated push replaces the earlier notification instead of stacking duplicates.
    await self.registration.showNotification(data.title || 'HealthNova', {
      body: data.body || 'HealthNova has an update for you.',
      tag: data.tag || 'healthnova',
      icon: ICON,
      badge: BADGE,
      data: { url: safePath(data.url), kind: data.kind || 'general' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = safePath(event.notification.data?.url);
  event.waitUntil((async () => {
    const clients = await windowClients();
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      // The React app navigates with its own router, keeping the signed-in session in memory.
      existing.postMessage({ type: 'healthnova:navigate', url: path });
      return;
    }
    await self.clients.openWindow(path);
  })());
});
