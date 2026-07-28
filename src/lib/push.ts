import { apiRequest } from "./api";

const DISMISS_PREFIX = "portal_push_choice_";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export function getPortalPushChoice(userId: string): "enabled" | "dismissed" | null {
  try {
    const value = localStorage.getItem(`${DISMISS_PREFIX}${userId}`);
    if (value === "enabled" || value === "dismissed") return value;
  } catch {
    /* ignore */
  }
  return null;
}

export function setPortalPushChoice(userId: string, choice: "enabled" | "dismissed") {
  try {
    localStorage.setItem(`${DISMISS_PREFIX}${userId}`, choice);
  } catch {
    /* ignore */
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function getPushRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  const registration =
    existing ??
    (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));

  // Force activate if still installing.
  if (registration.installing) {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const worker = registration.installing;
        if (!worker) {
          resolve();
          return;
        }
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated" || worker.state === "installed") resolve();
          if (worker.state === "redundant") reject(new Error("Service worker failed to install."));
        });
      }),
      12_000,
      "Service worker install timed out. Refresh the page and try again.",
    );
  }

  return withTimeout(
    navigator.serviceWorker.ready,
    12_000,
    "Service worker is not ready. Refresh the page and try Allow again.",
  );
}

export async function enableBrowserPush(accessToken: string) {
  const vapidPublicKey = (import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY as string | undefined)?.trim();
  if (!vapidPublicKey) {
    throw new Error("Push is not configured (missing VITE_PUSH_VAPID_PUBLIC_KEY in frontend .env). Restart frontend after adding it.");
  }
  if (!isPushSupported()) {
    throw new Error("This browser does not support push notifications.");
  }
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    throw new Error("Push requires HTTPS (or localhost).");
  }

  // If already denied, browser will not show the prompt again.
  if (Notification.permission === "denied") {
    throw new Error(
      "Notifications are blocked for this site. Click the lock icon in the address bar → Site settings → Notifications → Allow, then try again.",
    );
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted. Click Allow in the browser popup (top of the window).");
  }

  const registration = await getPushRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }),
        15_000,
        "Push subscribe timed out. Check VITE_PUSH_VAPID_PUBLIC_KEY matches backend PUSH_VAPID_PUBLIC_KEY.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Push subscribe failed";
      throw new Error(message);
    }
  }

  await withTimeout(
    apiRequest("/notifications/push/subscribe", accessToken, {
      method: "POST",
      body: JSON.stringify(subscription),
    }),
    15_000,
    "Saving push subscription timed out. Check backend is running.",
  );

  return subscription;
}

export async function disableBrowserPush(accessToken: string) {
  if (!isPushSupported()) return;
  const registration = await getPushRegistration().catch(() => null);
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await apiRequest("/notifications/push/unsubscribe", accessToken, {
    method: "DELETE",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}

export async function ensureBrowserPushSubscribed(accessToken: string) {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const vapidPublicKey = (import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY as string | undefined)?.trim();
  if (!vapidPublicKey) return false;

  try {
    const registration = await getPushRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }
    await apiRequest("/notifications/push/subscribe", accessToken, {
      method: "POST",
      body: JSON.stringify(subscription),
    });
    return true;
  } catch {
    return false;
  }
}
