import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

// Push services operated by the browsers we support. Subscriptions pointing anywhere else are rejected so the
// server can never be used to POST to arbitrary URLs.
const PUSH_SERVICE_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', '.notify.windows.com', '.push.apple.com'];
const MAX_SUBSCRIPTIONS_PER_USER = 10;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

let configured = null;
export function isPushConfigured() {
  if (configured !== null) return configured;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return (configured = false);
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  } catch (error) {
    console.error(`Web Push disabled: invalid VAPID configuration (${error.message})`);
    configured = false;
  }
  return configured;
}

export const vapidPublicKey = () => (isPushConfigured() ? process.env.VAPID_PUBLIC_KEY : null);

// Returns a clean { endpoint, keys } object, or null when the browser-supplied subscription is not acceptable.
export function sanitizeSubscription(input) {
  const endpoint = input?.endpoint;
  const p256dh = input?.keys?.p256dh;
  const auth = input?.keys?.auth;
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return null;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) return null;
  if (!BASE64URL.test(p256dh) || !BASE64URL.test(auth)) return null;
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  const host = url.hostname.toLowerCase();
  const knownHost = PUSH_SERVICE_HOSTS.some((allowed) => (allowed.startsWith('.') ? host.endsWith(allowed) : host === allowed));
  if (url.protocol !== 'https:' || !knownHost) return null;
  return { endpoint, keys: { p256dh, auth } };
}

// Returns false when the push service already rejected this endpoint; the browser must create a new subscription.
export async function saveSubscription(userId, subscription, userAgent) {
  if (await PushSubscription.exists({ endpoint: subscription.endpoint, expiredAt: { $ne: null } })) return false;
  // Re-subscribing from a shared browser moves that endpoint to whoever is signed in now.
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { user: userId, keys: subscription.keys, userAgent: userAgent?.slice(0, 300) },
    { upsert: true, setDefaultsOnInsert: true },
  );
  const extra = await PushSubscription.find({ user: userId }).sort({ updatedAt: -1 }).skip(MAX_SUBSCRIPTIONS_PER_USER).select('_id').lean();
  if (extra.length) await PushSubscription.deleteMany({ _id: { $in: extra.map((doc) => doc._id) } });
  return true;
}

export const removeSubscription = (userId, endpoint) => PushSubscription.deleteOne({ user: userId, endpoint });
export const countSubscriptions = (userId) => PushSubscription.countDocuments({ user: userId, expiredAt: null });

// Notification payloads deliberately carry no medical values: the lock screen is not private.
export const NOTIFICATIONS = {
  report: (reportId) => ({
    kind: 'report', title: 'HealthNova', body: 'Report analysis complete. Your health report analysis is ready to review.',
    url: reportId ? `/analysis?report=${encodeURIComponent(String(reportId))}` : '/history', tag: 'healthnova-report', onlyWhenHidden: true,
  }),
  water: () => ({ kind: 'water', title: '💧 HealthNova', body: 'Time to drink some water 💧 Take a short hydration break.', url: '/dashboard', tag: 'healthnova-water' }),
  test: () => ({ kind: 'test', title: 'HealthNova', body: 'Test notification: HealthNova notifications are working on this device.', url: '/settings', tag: 'healthnova-test' }),
};

// Sends one payload to every browser the user has subscribed. Returns how many deliveries the push services accepted.
export async function sendToUser(userId, payload) {
  if (!isPushConfigured()) return 0;
  const subscriptions = await PushSubscription.find({ user: userId, expiredAt: null }).lean();
  const body = JSON.stringify({ ...payload, sentAt: Date.now() });
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, body, { TTL: payload.kind === 'water' ? 15 * 60 : 60 * 60, urgency: 'normal', timeout: 10000 });
      await PushSubscription.updateOne({ _id: subscription._id }, { lastSuccessAt: new Date() });
      return true;
    } catch (error) {
      // 404/410: the browser dropped this subscription (permission revoked, site data cleared, etc.).
      if (error.statusCode === 404 || error.statusCode === 410) await PushSubscription.updateOne({ _id: subscription._id }, { expiredAt: new Date() });
      else console.warn(`[push] delivery failed user=${userId} status=${error.statusCode ?? 'n/a'}`);
      return false;
    }
  }));
  return results.filter(Boolean).length;
}
