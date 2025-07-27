/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { BackgroundSync } from 'workbox-background-sync';
import { Queue } from 'workbox-background-sync';

// Precache all static assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Cache API responses with network-first strategy
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      {
        cacheKeyWillBeUsed: async ({ request }) => {
          return `${request.url}?timestamp=${Date.now()}`;
        },
      },
    ],
  })
);

// Cache images with cache-first strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      {
        cacheWillUpdate: async ({ response }) => {
          return response.status === 200 ? response : null;
        },
      },
    ],
  })
);

// Cache static resources
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

// Background sync for offline form submissions
const bgSyncQueue = new Queue('form-submissions', {
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request);
        console.log('Background sync successful for:', entry.request.url);
      } catch (error) {
        console.error('Background sync failed for:', entry.request.url, error);
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

// Handle offline form submissions
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') && 
    (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE'),
  async ({ event }) => {
    try {
      const response = await fetch(event.request.clone());
      return response;
    } catch (error) {
      await bgSyncQueue.pushRequest({ request: event.request });
      return new Response(
        JSON.stringify({
          error: 'Request queued for background sync',
          offline: true,
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
);

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.primaryKey || 1,
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/logo192.png',
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/logo192.png',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Project Invoice', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

// Handle app installation
self.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  // Store the event for later use
  self.deferredPrompt = event;
});

// Skip waiting and claim clients immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});