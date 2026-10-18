import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Atom Salon — Barbershop Appointments',
  description: 'Premium barbershop appointment booking for men',
  applicationName: 'Atom Salon',
  manifest: '/site.webmanifest',
  // Safari on iOS asks for /apple-touch-icon.png and
  // /apple-touch-icon-precomposed.png on every visit unless the page names the
  // icons itself. Those guesses used to reach the Worker and cost a full 404
  // render; the files below are static assets, so they never wake it.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '256x256' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/apple-touch-icon-precomposed.png',
      },
    ],
  },
  appleWebApp: {
    title: 'Atom Salon',
    capable: true,
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-zinc-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
