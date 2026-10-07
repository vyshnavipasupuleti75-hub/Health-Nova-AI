// Browser side of HealthNova notifications: the service worker (public/sw.js) plus the Web Push subscription
// that lets the backend deliver report and drink-water notifications while the app is in the background.
import { deletePushSubscription, getNotificationConfig, savePushSubscription } from '../services/notifications';

export const pushSupported = () => typeof window !== 'undefined' && window.isSecureContext
  && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

export const notificationPermission = () => (pushSupported() ? Notification.permission : 'unsupported');

export class NotificationSetupError extends Error {
  constructor(reason, message) { super(message); this.reason = reason; }
}

let registrationPromise = null;
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return Promise.resolve(null);
  registrationPromise ??= navigator.serviceWorker.register('/sw.js')
    .then(() => navigator.serviceWorker.ready)
    .catch(() => { registrationPromise = null; return null; });
  return registrationPromise;
}

// Must be called straight from the user's click so the browser shows its permission prompt.
export async function requestNotificationPermission() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

function vapidKeyBytes(base64Url) {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function sameKey(buffer, bytes) {
  if (!buffer) return false;
  const current = new Uint8Array(buffer);
  return current.length === bytes.length && current.every((value, index) => value === bytes[index]);
}

// Subscribes this browser (or reuses its subscription) and registers it with the backend for the signed-in user.
export async function ensurePushSubscription() {
  if (!pushSupported()) throw new NotificationSetupError('unsupported', 'This browser does not support HealthNova notifications.');
  if (Notification.permission !== 'granted') throw new NotificationSetupError('permission', 'Notification permission has not been granted.');
  const registration = await registerServiceWorker();
  if (!registration) throw new NotificationSetupError('service-worker', 'HealthNova could not start its notification service in this browser.');
  const { data: config } = await getNotificationConfig();
  if (!config.pushConfigured || !config.publicKey) throw new NotificationSetupError('server', 'Notifications are not available on this server yet.');

  const key = vapidKeyBytes(config.publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options?.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    } catch {
      throw new NotificationSetupError('subscribe', 'Your browser could not set up push notifications. Please try again.');
    }
    try {
      await savePushSubscription(subscription.toJSON());
      return subscription;
    } catch (error) {
      // The push service has already rejected this subscription: replace it with a fresh one (once).
      if (error.response?.data?.code !== 'SUBSCRIPTION_EXPIRED' || attempt > 0) throw error;
      await subscription.unsubscribe().catch(() => {});
      subscription = null;
    }
  }
}

// On logout: stop this browser receiving the previous user's notifications.
export async function detachPushSubscription(token) {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await deletePushSubscription(subscription.endpoint, token).catch(() => {});
    await subscription.unsubscribe();
  } catch { /* logout must never fail because of notifications */ }
}

// Shows a notification through the service worker (works on Android, where `new Notification()` does not).
export async function showLocalNotification(title, options) {
  if (notificationPermission() !== 'granted') return false;
  const registration = await registerServiceWorker();
  if (!registration) return false;
  await registration.showNotification(title, { icon: '/notification-icon.png', badge: '/notification-badge.png', ...options });
  return true;
}
