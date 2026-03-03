import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or installed as PWA
    if (localStorage.getItem('pwa-dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem('pwa-dismissed', '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 1000,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    }}>
      <img src="/icons/icon-72x72.png" alt="LucaEats" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Instala LucaEats en tu móvil</p>
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Acceso rápido desde la pantalla de inicio</p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button className="btn btn-primary btn-sm" onClick={handleInstall}>
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 18, padding: '4px 6px', lineHeight: 1,
          }}
        >✕</button>
      </div>
    </div>
  );
}
