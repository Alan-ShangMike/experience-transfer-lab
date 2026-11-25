import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return ['/api/admin/:path*', '/admin/:path*'].map((source) => ({
      source,
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    }));
  },
};

export default config;
