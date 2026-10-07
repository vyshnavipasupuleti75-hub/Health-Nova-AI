// Notification settings, push subscription validation and Google account-linking guards (no database needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { NOTIFICATIONS, sanitizeSubscription } from '../services/pushService.js';
import { updateSettings } from '../controllers/userController.js';
import { googleLogin, linkGoogleAccount } from '../controllers/authController.js';

process.env.JWT_SECRET ||= 'test-secret';

const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };

function mockRes() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function mockUser(settings = {}) {
  return {
    settings: { toObject: () => ({ healthNotifications: false, waterReminders: { enabled: false, intervalMinutes: 120 }, language: 'en', darkMode: false, ...settings }) },
    saved: false,
    // Like a Mongoose subdocument, saved settings can be read back with toObject().
    async save() { const plain = { ...this.settings }; delete plain.toObject; this.settings = { ...plain, toObject: () => plain }; this.saved = true; },
    toObject() { return { settings: this.settings, waterReminderNextAt: this.waterReminderNextAt }; },
  };
}

async function callSettings(user, body) {
  const res = mockRes();
  let error;
  await updateSettings({ user, body }, res, (e) => { error = e; });
  if (error) throw error;
  return res;
}

test('push subscriptions are only accepted for known browser push services over https', () => {
  assert.deepEqual(sanitizeSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys }), { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys });
  assert.ok(sanitizeSubscription({ endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/x', keys }));
  assert.ok(sanitizeSubscription({ endpoint: 'https://wns2-par02p.notify.windows.com/w/?token=x', keys }));
  assert.ok(sanitizeSubscription({ endpoint: 'https://web.push.apple.com/x', keys }));
  assert.equal(sanitizeSubscription({ endpoint: 'https://evil.example.com/fcm.googleapis.com', keys }), null);
  assert.equal(sanitizeSubscription({ endpoint: 'http://fcm.googleapis.com/fcm/send/abc', keys }), null);
  assert.equal(sanitizeSubscription({ endpoint: 'https://169.254.169.254/latest', keys }), null);
  assert.equal(sanitizeSubscription({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'not base64!', auth: keys.auth } }), null);
  assert.equal(sanitizeSubscription(null), null);
});

test('notification payloads never contain medical values and only link to app paths', () => {
  const report = NOTIFICATIONS.report('66f0c0ffee0000000000abcd');
  assert.equal(report.title, 'HealthNova');
  assert.match(report.body, /ready to review/);
  assert.equal(report.url, '/analysis?report=66f0c0ffee0000000000abcd');
  assert.equal(report.onlyWhenHidden, true);
  const water = NOTIFICATIONS.water();
  assert.match(water.body, /drink some water/);
  assert.doesNotMatch(water.body, /\d+\s*(ml|l|litre|liter|glass)/i, 'no prescribed amount of water');
  assert.equal(water.url, '/dashboard');
  for (const payload of [report, water, NOTIFICATIONS.test()]) assert.ok(payload.url.startsWith('/') && !payload.url.startsWith('//'));
});

test('enabling water reminders saves the interval and schedules the next reminder', async () => {
  const user = mockUser();
  const before = Date.now();
  const res = await callSettings(user, { waterReminders: { enabled: true, intervalMinutes: 120 } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(user.settings.toObject().waterReminders, { enabled: true, intervalMinutes: 120 });
  const due = user.waterReminderNextAt.getTime() - before;
  assert.ok(due >= 120 * 60 * 1000 && due < 121 * 60 * 1000);
  assert.equal(res.body.waterReminderNextAt, undefined, 'scheduling state is not sent to the client');
  assert.equal(user.saved, true);
});

test('disabling water reminders cancels the next reminder; unchanged settings keep the countdown', async () => {
  const enabled = mockUser({ waterReminders: { enabled: true, intervalMinutes: 60 } });
  enabled.waterReminderNextAt = new Date('2026-10-07T10:00:00Z');
  await callSettings(enabled, { darkMode: true });
  assert.equal(enabled.waterReminderNextAt.toISOString(), '2026-10-07T10:00:00.000Z');
  await callSettings(enabled, { waterReminders: { enabled: false } });
  assert.equal(enabled.waterReminderNextAt, undefined);
  assert.equal(enabled.settings.waterReminders.intervalMinutes, 60);
});

test('settings validation rejects bad notification values and keeps other settings', async () => {
  assert.equal((await callSettings(mockUser(), { waterReminders: { enabled: true, intervalMinutes: 5 } })).statusCode, 400);
  assert.equal((await callSettings(mockUser(), { waterReminders: { enabled: 'yes' } })).statusCode, 400);
  assert.equal((await callSettings(mockUser(), { healthNotifications: 'on' })).statusCode, 400);
  const user = mockUser({ language: 'te', darkMode: true });
  await callSettings(user, { healthNotifications: true });
  assert.equal(user.settings.healthNotifications, true);
  assert.equal(user.settings.language, 'te');
  assert.equal(user.settings.darkMode, true);
});

test('Google sign-in rejects missing or unverifiable credentials without a server error', async () => {
  process.env.GOOGLE_CLIENT_ID ||= 'test-client.apps.googleusercontent.com';
  const missing = mockRes();
  await googleLogin({ body: {} }, missing, assert.fail);
  assert.equal(missing.statusCode, 400);
  const forged = mockRes();
  const fakeToken = jwt.sign({ sub: '123', email: 'victim@gmail.com', email_verified: true }, 'attacker-secret');
  await googleLogin({ body: { credential: fakeToken } }, forged, assert.fail);
  assert.equal(forged.statusCode, 401);
  assert.doesNotMatch(forged.body.message, /eyJ/, 'never echoes the token');
});

test('Google account linking needs a valid, purpose-bound link token', async () => {
  const expired = mockRes();
  await linkGoogleAccount({ body: { linkToken: jwt.sign({ purpose: 'google-link', uid: 'u', sub: 's' }, process.env.JWT_SECRET, { expiresIn: -10 }), password: 'x' } }, expired, assert.fail);
  assert.equal(expired.statusCode, 401);
  const sessionToken = mockRes();
  await linkGoogleAccount({ body: { linkToken: jwt.sign({ id: 'u' }, process.env.JWT_SECRET), password: 'x' } }, sessionToken, assert.fail);
  assert.equal(sessionToken.statusCode, 401, 'a login JWT cannot be used to link an account');
  const noPassword = mockRes();
  await linkGoogleAccount({ body: { linkToken: 'anything' } }, noPassword, assert.fail);
  assert.equal(noPassword.statusCode, 400);
});
