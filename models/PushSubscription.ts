import mongoose from 'mongoose';

export interface IPushSubscription {
  _id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  // Barbers subscribe as their User id, customers as their Customer id.
  ownerType: 'barber' | 'customer';
  ownerId: string;
  language: 'en' | 'ar';
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new mongoose.Schema<IPushSubscription>(
  {
    endpoint: { type: String, required: true, trim: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    ownerType: {
      type: String,
      enum: ['barber', 'customer'],
      required: true,
    },
    ownerId: { type: String, required: true },
    language: { type: String, enum: ['en', 'ar'], default: 'ar' },
  },
  { timestamps: true }
);

// One browser can hold a barber and a customer subscription at the same time
// (e.g. a barber testing the booking page), but only one of each.
pushSubscriptionSchema.index({ endpoint: 1, ownerType: 1 }, { unique: true });
pushSubscriptionSchema.index({ ownerType: 1, ownerId: 1 });

export default mongoose.models.PushSubscription ||
  mongoose.model<IPushSubscription>('PushSubscription', pushSubscriptionSchema);
