import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tejasvi.accessnav',
  appName: 'AccessNav',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  }
};

export default config;