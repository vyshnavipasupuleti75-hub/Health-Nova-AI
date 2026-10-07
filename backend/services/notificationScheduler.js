import mongoose from 'mongoose';
import User from '../models/User.js';
import { isPushConfigured, NOTIFICATIONS, sendToUser } from './pushService.js';

const TICK_MS = 60 * 1000;

export const nextWaterReminderAt = (intervalMinutes, from = Date.now()) => new Date(from + intervalMinutes * 60 * 1000);

// Sends every drink-water reminder that is due. Each user's slot is claimed with a conditional update first,
// so overlapping ticks (or several server instances) never send the same reminder twice.
export async function sendDueWaterReminders(now = new Date(), send = sendToUser) {
  const due = await User.find({ 'settings.waterReminders.enabled': true, waterReminderNextAt: { $lte: now } })
    .select('_id settings.waterReminders waterReminderNextAt').limit(500).lean();
  let sent = 0;
  for (const user of due) {
    const interval = user.settings?.waterReminders?.intervalMinutes || 120;
    const claimed = await User.updateOne(
      { _id: user._id, waterReminderNextAt: user.waterReminderNextAt, 'settings.waterReminders.enabled': true },
      { $set: { waterReminderNextAt: nextWaterReminderAt(interval, now.getTime()) } },
    );
    if (claimed.modifiedCount === 1 && (await send(user._id, NOTIFICATIONS.water())) > 0) sent += 1;
  }
  return sent;
}

let timer = null;
export function startNotificationScheduler() {
  if (timer) return;
  if (!isPushConfigured()) {
    console.warn('Web Push is not configured (VAPID_* in backend/.env): drink-water reminders and background notifications are disabled.');
    return;
  }
  let running = false;
  timer = setInterval(async () => {
    if (running || mongoose.connection.readyState !== 1) return;
    running = true;
    try { await sendDueWaterReminders(); } catch (error) { console.error(`[reminders] ${error.message}`); } finally { running = false; }
  }, TICK_MS);
  timer.unref();
}
