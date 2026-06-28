import mongoose from 'mongoose';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'barber' | 'staff';
  department?: string;
  staffTypeId?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false },
    role: {
      type: String,
      enum: ['admin', 'barber', 'staff'],
      required: true,
    },
    department: { type: String, trim: true },
    staffTypeId: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, active: 1 });
userSchema.index({ department: 1 });

export default mongoose.models.User ||
  mongoose.model<IUser>('User', userSchema);
