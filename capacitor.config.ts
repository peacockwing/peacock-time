import type { CapacitorConfig } from '@capacitor/cli';

// Remote-server mode: the native shell loads the live, already-deployed
// Next.js app (Vercel) instead of a locally bundled static export. This is
// deliberate, not a shortcut - peacock-time relies on real server-rendered
// API routes (Prisma/Supabase queries, Claude API calls that need secret
// keys) that a static `next export` bundle can't run. The native app is a
// dedicated app-store-installable shell around the same production site,
// with room to layer in native plugins (camera, local notifications, etc.)
// incrementally.
const config: CapacitorConfig = {
  appId: 'com.peacocktime.app',
  appName: '피콕타임',
  webDir: 'mobile-shell',
  server: {
    url: 'https://peacock-time.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;
