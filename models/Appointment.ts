import mongoose from 'mongoose';

export interface IAppointment {
  _id: string;
  customerName: string;
  date: string;
  time: string;
  barberId: string;
  barberName: string;
  department?: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new mongoose.Schema<IAppointment>(
  {
    customerName: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    barberId: { type: String, required: true, index: true },
    barberName: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'cancelled', 'completed'],
      default: 'scheduled',
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

appointmentSchema.index({ date: 1, time: 1, barberId: 1 });
appointmentSchema.index({ department: 1 });

export default mongoose.models.Appointment ||
  mongoose.model<IAppointment>('Appointment', appointmentSchema);
