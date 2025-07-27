/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { BackgroundSync } from 'workbox-background-sync';
import { Queue } from 'workbox-background-sync';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache all static assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Cache API responses with network-first strategy
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && url.pathname.includes('/projects'),
  new NetworkFirst({
    cacheName: 'projects-api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && url.pathname.includes('/invoices'),
  new NetworkFirst({
    cacheName: 'invoices-api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 10 * 60, // 10 minutes
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && url.pathname.includes('/clients'),
  new NetworkFirst({
    cacheName: 'clients-api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 60, // 30 minutes
      }),
    ],
  })
);

// Cache time entries with shorter expiration
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && url.pathname.includes('/time-entries'),
  new NetworkFirst({
    cacheName: 'time-entries-api-cache',
    networkTimeoutSeconds: 2,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 2 * 60, // 2 minutes
      }),
    ],
  })
);

// Cache dashboard data with very short expiration
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && url.pathname.includes('/dashboard'),
  new NetworkFirst({
    cacheName: 'dashboard-api-cache',
    networkTimeoutSeconds: 2,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 1 * 60, // 1 minute
      }),
    ],
  })
);

// Don't cache authentication endpoints
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/auth'),
  new NetworkOnly()
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

// Background sync queues for different types of data
const projectSyncQueue = new Queue('project-sync', {
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request);
        if (response.ok) {
          console.log('Project sync successful for:', entry.request.url);
          // Notify the client about successful sync
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                data: { url: entry.request.url, type: 'project' }
              });
            });
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Project sync failed for:', entry.request.url, error);
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

const invoiceSyncQueue = new Queue('invoice-sync', {
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request);
        if (response.ok) {
          console.log('Invoice sync successful for:', entry.request.url);
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                data: { url: entry.request.url, type: 'invoice' }
              });
            });
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Invoice sync failed for:', entry.request.url, error);
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

const timeEntrySyncQueue = new Queue('time-entry-sync', {
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request);
        if (response.ok) {
          console.log('Time entry sync successful for:', entry.request.url);
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                data: { url: entry.request.url, type: 'time-entry' }
              });
            });
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Time entry sync failed for:', entry.request.url, error);
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

// Handle offline form submissions with proper queue routing
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/projects') && 
    (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE'),
  async ({ event }) => {
    try {
      const response = await fetch(event.request.clone());
      return response;
    } catch (error) {
      await projectSyncQueue.pushRequest({ request: event.request });
      return new Response(
        JSON.stringify({
          error: 'Project request queued for background sync',
          offline: true,
          type: 'project'
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
);

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/invoices') && 
    (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE'),
  async ({ event }) => {
    try {
      const response = await fetch(event.request.clone());
      return response;
    } catch (error) {
      await invoiceSyncQueue.pushRequest({ request: event.request });
      return new Response(
        JSON.stringify({
          error: 'Invoice request queued for background sync',
          offline: true,
          type: 'invoice'
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
);

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/time-entries') && 
    (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE'),
  async ({ event }) => {
    try {
      const response = await fetch(event.request.clone());
      return response;
    } catch (error) {
      await timeEntrySyncQueue.pushRequest({ request: event.request });
      return new Response(
        JSON.stringify({
          error: 'Time entry request queued for background sync',
          offline: true,
          type: 'time-entry'
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