import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MR GYM Admin',
    short_name: 'MR GYM',
    description: 'Gym Management Dashboard',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F7F8FA',
    theme_color: '#2563EB',
    icons: [
      { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
