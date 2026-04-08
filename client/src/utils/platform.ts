// ============================================================
//  Platform detection — sin acoplamiento con Capacitor
//
//  CRÍTICO: este módulo NO importa nada de @capacitor/core.
//  Detecta runtime con typeof window.Capacitor. En build web,
//  Vite hace tree-shaking de todos los if (isNative()) porque
//  siempre evalúa false en web — bundle web idéntico al actual.
//
//  Los plugins (@capacitor/camera, @capacitor/browser, etc.) se
//  importan con `await import(...)` SOLO dentro del bloque
//  if (isNative()), garantizando que no entran en el bundle web.
// ============================================================

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.Capacitor !== 'undefined' &&
         window.Capacitor.isNativePlatform?.() === true;
}

export function isIOS(): boolean {
  return isNative() && window.Capacitor?.getPlatform?.() === 'ios';
}

export function isAndroid(): boolean {
  return isNative() && window.Capacitor?.getPlatform?.() === 'android';
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  if (!isNative()) return 'web';
  return window.Capacitor?.getPlatform?.() === 'ios' ? 'ios' : 'android';
}

/**
 * Abrir un link externo. En web usa window.open con noopener.
 * En native usa Capacitor Browser plugin (in-app browser de iOS).
 */
export async function openExternal(url: string): Promise<void> {
  if (isNative()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
    } catch {
      // Fallback si el plugin no está instalado todavía
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
