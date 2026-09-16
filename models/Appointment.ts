import mongoose from 'mongoose';

export interface IAppointment {
  _id: string;
  customerName: string;
  customerPhone?: string;
  customerId?: string;
  date: string;
  time: string;
  barberId: string;
  barberName: string;
  department?: string;
  status: 'unconfirmed' | 'pending' | 'scheduled' | 'cancelled' | 'completed';
  transferNumber?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new mongoose.Schema<IAppointment>(
  {
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, trim: true },
    customerId: { type: String, index: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    barberId: { type: String, required: true, index: true },
    barberName: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    status: {
      type: String,
      enum: ['unconfirmed', 'pending', 'scheduled', 'cancelled', 'completed'],
      default: 'scheduled',
    },
    transferNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

appointmentSchema.index({ date: 1, time: 1, barberId: 1 });
appointmentSchema.index({ department: 1 });
appointmentSchema.index({ customerId: 1, status: 1 });
// `unconfirmed` is deliberately left out: several customers may hold an unpaid
// booking on the same time, and the first one to pay wins the slot.
appointmentSchema.index(
  { barberId: 1, date: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['scheduled', 'pending'] } },
    name: 'unique_scheduled_slot',
  }
);

export default mongoose.models.Appointment ||
  mongoose.model<IAppointment>('Appointment', appointmentSchema);
