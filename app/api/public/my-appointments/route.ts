import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Customer from '@/models/Customer';
import Appointment from '@/models/Appointment';
import { readGuestToken, withGuestCookie } from '@/lib/guest';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = readGuestToken(request, searchParams.get('token'));

    if (!token) {
      return NextResponse.json({ customer: null, appointments: [] });
    }

    await dbConnect();

    const customer = await Customer.findOne({ guestToken: token });
    if (!customer) {
      return NextResponse.json({ customer: null, appointments: [] });
    }

    const appointments = await Appointment.find({
      customerId: customer._id.toString(),
    }).sort({ date: 1, time: 1 });

    const response = NextResponse.json({
      customer: {
        name: customer.name,
        phone: customer.phone,
      },
      guestToken: token,
      appointments,
    });

    return withGuestCookie(response, token);
  } catch (error) {
    console.error('GET /api/public/my-appointments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
