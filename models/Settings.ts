import mongoose from 'mongoose';

export interface ISettings {
  _id: string;
  systemTitle: string;
  tagline?: string;
  slotDuration?: number;
  payToConfirm?: boolean;
  requireTransferNumber?: boolean;
  paymentAmount?: string;
  paymentCurrency?: string;
  cliqNumber?: string;
  cliqBank?: string;
  allowBarberBreaks?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new mongoose.Schema<ISettings>(
  {
    systemTitle: { type: String, default: 'Atom Salon' },
    tagline: { type: String, default: 'Premium Barbershop for Men' },
    slotDuration: { type: Number, default: 30, min: 5, max: 240 },
    payToConfirm: { type: Boolean, default: false },
    requireTransferNumber: { type: Boolean, default: true },
    paymentAmount: { type: String, default: '1' },
    paymentCurrency: { type: String, default: 'JOD' },
    cliqNumber: { type: String, default: '00962797598857' },
    cliqBank: { type: String, default: 'Arab Banks' },
    allowBarberBreaks: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Settings ||
  mongoose.model<ISettings>('Settings', settingsSchema);
