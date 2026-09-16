import './load-env';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

// The seed runs in plain Node, so it opens and closes its own client rather
// than going through lib/mongodb.ts (which scopes connections to a Worker
// request).
async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const now = new Date();

    const users = db.collection('users');
    const existingAdmin = await users.findOne({ email: 'admin@salon.com' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await users.insertOne({
        name: 'Salon Admin',
        email: 'admin@salon.com',
        password: hashedPassword,
        role: 'admin',
        active: true,
        workingHours: [],
        breaks: [],
        cliqNumber: '',
        cliqBank: '',
        createdAt: now,
        updatedAt: now,
      });
      console.log('Created admin: admin@salon.com / admin123');
    } else {
      console.log('Admin already exists');
    }

    const settingsCollection = db.collection('settings');
    const settings = await settingsCollection.findOne({});
    if (!settings) {
      await settingsCollection.insertOne({
        systemTitle: 'Atom Salon',
        tagline: 'Premium Barbershop for Men',
        slotDuration: 30,
        payToConfirm: false,
        requireTransferNumber: true,
        paymentAmount: '1',
        paymentCurrency: 'JOD',
        cliqNumber: '00962797598857',
        cliqBank: 'Arab Banks',
        allowBarberBreaks: false,
        createdAt: now,
        updatedAt: now,
      });
      console.log('Created default settings');
    }

    console.log('Seed complete');
  } finally {
    await client.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
