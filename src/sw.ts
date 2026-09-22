import { precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>;
};

self.skipWaiting();
clientsClaim();

// Inyectado en build time por vite-plugin-pwa (estrategia injectManifest).
precacheAndRoute(self.__WB_MANIFEST);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

self.addEventListener("push", (event) => {
  let payload: PushPayload = { title: "Fire Intranet", body: "Tenes una notificacion nueva." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Payload no era JSON valido -- se muestra el mensaje generico.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

// Al tocar la notificacion: si ya hay una pestana de la app abierta, la
// enfoca y navega; si no, abre una nueva.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) (client as WindowClient).navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
