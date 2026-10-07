import { countSubscriptions, isPushConfigured, NOTIFICATIONS, removeSubscription, sanitizeSubscription, saveSubscription, sendToUser, vapidPublicKey } from '../services/pushService.js';

const TEST_COOLDOWN_MS = 10 * 1000;
const lastTestAt = new Map();
const unavailable = (res) => res.status(503).json({ message: 'Notifications are not available on this server yet.' });

export async function getNotificationConfig(req, res, next) {
  try {
    res.json({ pushConfigured: isPushConfigured(), publicKey: vapidPublicKey(), subscriptions: await countSubscriptions(req.user._id) });
  } catch (error) { next(error); }
}

export async function subscribe(req, res, next) {
  try {
    if (!isPushConfigured()) return unavailable(res);
    const subscription = sanitizeSubscription(req.body?.subscription);
    if (!subscription) return res.status(400).json({ message: 'This browser returned an unsupported notification subscription.' });
    if (!(await saveSubscription(req.user._id, subscription, req.get('user-agent')))) return res.status(410).json({ code: 'SUBSCRIPTION_EXPIRED', message: 'This browser subscription has expired. Please try again.' });
    res.status(201).json({ subscribed: true });
  } catch (error) { next(error); }
}

export async function unsubscribe(req, res, next) {
  try {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) return res.status(400).json({ message: 'Subscription endpoint is required' });
    await removeSubscription(req.user._id, endpoint); // only ever deletes the caller's own subscription
    res.json({ subscribed: false });
  } catch (error) { next(error); }
}

export async function sendTestNotification(req, res, next) {
  try {
    if (!isPushConfigured()) return unavailable(res);
    const key = String(req.user._id);
    const now = Date.now();
    if (now - (lastTestAt.get(key) || 0) < TEST_COOLDOWN_MS) return res.status(429).json({ message: 'Please wait a few seconds before sending another test.' });
    lastTestAt.set(key, now);
    const payload = req.body?.kind === 'water' ? NOTIFICATIONS.water() : NOTIFICATIONS.test();
    const delivered = await sendToUser(req.user._id, payload);
    if (!delivered) return res.status(409).json({ message: 'No browser is set up to receive HealthNova notifications yet. Turn notifications on first.' });
    res.json({ delivered });
  } catch (error) { next(error); }
}
