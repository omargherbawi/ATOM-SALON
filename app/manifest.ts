import type { MetadataRoute } from 'next';

// iPhones only allow web push for sites added to the Home Screen, which needs
// a manifest with `display: standalone`.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Atom Salon',
    short_name: 'Atom Salon',
    description: 'Premium barbershop appointment booking for men',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
