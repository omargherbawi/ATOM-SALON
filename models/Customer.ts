import mongoose from 'mongoose';

export interface ICustomer {
  _id: string;
  name: string;
  phone: string;
  guestToken: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new mongoose.Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    guestToken: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

customerSchema.index({ phone: 1 });

export default mongoose.models.Customer ||
  mongoose.model<ICustomer>('Customer', customerSchema);
