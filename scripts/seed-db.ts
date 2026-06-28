import './load-env';
import bcrypt from 'bcryptjs';
import dbConnect from '../lib/mongodb';
import User from '../models/User';
import Settings from '../models/Settings';

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await dbConnect();

  const existingAdmin = await User.findOne({ email: 'admin@salon.com' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    await User.create({
      name: 'Salon Admin',
      email: 'admin@salon.com',
      password: hashedPassword,
      role: 'admin',
      active: true,
    });
    console.log('Created admin: admin@salon.com / admin123');
  } else {
    console.log('Admin already exists');
  }

  const settings = await Settings.findOne();
  if (!settings) {
    await Settings.create({
      systemTitle: 'Atom Salon',
      tagline: 'Premium Barbershop for Men',
    });
    console.log('Created default settings');
  }

  console.log('Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
