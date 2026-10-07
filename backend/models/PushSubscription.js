import mongoose from 'mongoose';

// One Web Push subscription per browser profile. The owner always comes from the JWT, never from the request body.
const pushSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
  userAgent: { type: String, maxlength: 300 },
  lastSuccessAt: Date,
  // Set when the push service answers 404/410. Kept for a while so a browser re-sending the dead subscription
  // is told to replace it instead of silently re-registering an endpoint that can never deliver.
  expiredAt: { type: Date, default: null },
}, { timestamps: true });
pushSubscriptionSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
