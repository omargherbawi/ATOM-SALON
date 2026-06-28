import mongoose from 'mongoose';

export interface ISettings {
  _id: string;
  systemTitle: string;
  tagline?: string;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new mongoose.Schema<ISettings>(
  {
    systemTitle: { type: String, default: 'Atom Salon' },
    tagline: { type: String, default: 'Premium Barbershop for Men' },
  },
  { timestamps: true }
);

export default mongoose.models.Settings ||
  mongoose.model<ISettings>('Settings', settingsSchema);
