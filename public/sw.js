function resolveClickUrl(raw) {
  const fallback = `${self.location.origin}/#/notifications`;
  if (!raw || typeof raw !== "string") return fallback;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const parsed = new URL(raw);
      if (parsed.origin === self.location.origin) {
        return `${self.location.origin}${parsed.hash || "/#/notifications"}`;
      }
      return raw;
    }
    if (raw.startsWith("/#/")) return `${self.location.origin}${raw}`;
    if (raw.startsWith("#/")) return `${self.location.origin}/${raw}`;
  } catch {
    /* ignore */
  }
  return fallback;
}

function hashFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hash || "#/notifications";
  } catch {
    return "#/notifications";
  }
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "New notification";
  const clickUrl = resolveClickUrl(payload.url);
  const options = {
    body: payload.body || "You have a new update.",
    data: { url: clickUrl },
    tag: payload.type || "general",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = resolveClickUrl(event.notification?.data?.url);
  const hash = hashFromUrl(targetUrl);

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if (!client.url.startsWith(self.location.origin)) continue;
        if (!("focus" in client)) continue;
        await client.focus();
        client.postMessage({ type: "PUSH_NAVIGATE", hash });
        return;
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});
