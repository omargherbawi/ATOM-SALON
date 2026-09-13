import mongoose from 'mongoose';

export interface IWorkingHours {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
}

export interface IBreak {
  date: string;
  start: string;
  end: string;
}

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'barber' | 'staff';
  department?: string;
  staffTypeId?: string;
  active: boolean;
  workingHours: IWorkingHours[];
  breaks: IBreak[];
  cliqNumber?: string;
  cliqBank?: string;
  createdAt: Date;
  updatedAt: Date;
}

const workingHoursSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '18:00' },
  },
  { _id: false }
);

const breakSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false }
);

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
    workingHours: { type: [workingHoursSchema], default: [] },
    breaks: { type: [breakSchema], default: [] },
    cliqNumber: { type: String, trim: true, default: '' },
    cliqBank: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, active: 1 });
userSchema.index({ department: 1 });

export default mongoose.models.User ||
  mongoose.model<IUser>('User', userSchema);
