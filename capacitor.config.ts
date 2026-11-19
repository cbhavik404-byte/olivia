import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.remix.nexa.ai',
  appName: 'Nexa AI Vision Assistant',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
