// ============================================================
//  Capacitor config — Caliro iOS wrap
//
//  Bundle ID:   dev.caliro.app
//  webDir:      dist/app  (post-build script mueve app.html aquí)
//
//  Para sincronizar tras un cambio:
//    cd client && npm run build && npx cap sync ios
//
//  Para abrir Xcode (solo Mac):
//    npx cap open ios
// ============================================================

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.caliro.app',
  appName: 'Caliro',
  webDir: 'dist/app',

  ios: {
    contentInset: 'automatic',
    backgroundColor: '#F5F2EE',
    scheme: 'Caliro',
    // Restringe navegación a dominios autorizados (seguridad)
    limitsNavigationsToAppBoundDomains: true,
  },

  // El servidor remoto NO se usa — la app se sirve desde dist/app/ embebido.
  // Si quisiéramos hot-reload contra dev server, descomentaríamos esto:
  // server: { url: 'http://192.168.1.X:5173', cleartext: true },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#F5F2EE',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',  // texto oscuro sobre fondo claro
      backgroundColor: '#F5F2EE',
      overlaysWebView: false,
    },
  },
};

export default config;
