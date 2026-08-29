import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.atlastays.app',
  appName: 'Atlas Stays',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      // Must match the ground of resources/splash.png (white with the sky-blue mark).
      // A mismatched colour shows as a border on aspect ratios the splash does not fill.
      backgroundColor: '#FFFFFF',
    },
  },
};

export default config;
