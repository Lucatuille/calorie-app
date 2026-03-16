import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { fetchProductByBarcode, calculateNutrition } from '../utils/openfoodfacts';

const READER_ID = 'barcode-reader-container';

export default function BarcodeScanner({ isOpen, onClose, onAddProduct }) {
  const [status,        setStatus]        = useState('scanning');
  // scanning | loading | found | not_found | error | camera_error
  const [product,       setProduct]       = useState(null);
  const [grams,         setGrams]         = useState(100);
  const [manualBarcode, setManualBarcode] = useState('');
  const [lastBarcode,   setLastBarcode]   = useState('');
  const [visible,       setVisible]       = useState(false);
  const [animOpen,      setAnimOpen]      = useState(false);

  const scannerRef     = useRef(null);
  const isProcessing   = useRef(false);
  const closeTimer     = useRef(null);
  const scanStarted    = useRef(false);

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 640
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const h = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Sheet open/close animation
  useEffect(() => {
    if (isOpen) {
      clearTimeout(closeTimer.current);
      setStatus('scanning');
      setProduct(null);
      setGrams(100);
      setManualBarcode('');
      setLastBarcode('');
      isProcessing.current = false;
      scanStarted.current  = false;
      setVisible(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimOpen(true))
      );
      return () => cancelAnimationFrame(raf);
    } else {
      setAnimOpen(false);
      closeTimer.current = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(closeTimer.current);
    }
  }, [isOpen]);

  // Start camera once sheet is open and status is scanning
  useEffect(() => {
    if (!visible || !isOpen || status !== 'scanning' || scanStarted.current) return;
    scanStarted.current = true;
    const t = setTimeout(startScanner, 350); // wait for animation
    return () => clearTimeout(t);
  }, [visible, isOpen, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => { stopScanner(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && isOpen) handleClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scanner control ─────────────────────────────────────────

  async function startScanner() {
    const el = document.getElementById(READER_ID);
    if (!el) { setStatus('camera_error'); return; }

    try {
      const scanner = new Html5Qrcode(READER_ID);

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 110 },
          aspectRatio: 1.5,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
        },
        async (decodedText) => {
          if (isProcessing.current) return;
          isProcessing.current = true;
          await stopScanner();
          setLastBarcode(decodedText);
          setStatus('loading');
          await lookupBarcode(decodedText);
        },
        () => {} // frame errors — ignore silently
      );

      scannerRef.current = scanner;
    } catch {
      setStatus('camera_error');
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      try { scannerRef.current.clear(); }     catch {}
      scannerRef.current = null;
    }
  }

  async function lookupBarcode(code) {
    const result = await fetchProductByBarcode(code);
    if (result === null) {
      setStatus('not_found');
    } else if (result === 'timeout' || result === 'error') {
      setStatus('error');
    } else {
      setProduct(result);
      setGrams(result.quantity || 100);
      setStatus('found');
    }
  }

  // ── Handlers ────────────────────────────────────────────────

  async function handleClose() {
    await stopScanner();
    onClose();
  }

  async function handleRetry() {
    await stopScanner();
    isProcessing.current = false;
    scanStarted.current  = false;
    setProduct(null);
    setLastBarcode('');
    setManualBarcode('');
    setStatus('scanning');
  }

  async function handleManualSearch() {
    const code = manualBarcode.trim();
    if (!code) return;
    await stopScanner();
    isProcessing.current = true;
    setLastBarcode(code);
    setStatus('loading');
    await lookupBarcode(code);
  }

  function handleAdd() {
    if (!product) return;
    const nutrition = calculateNutrition(product, grams);
    onAddProduct(product, nutrition);
    handleClose();
  }

  // ── Derived ─────────────────────────────────────────────────

  const nutrition = product ? calculateNutrition(product, grams) : null;
  const showManualInput = ['scanning', 'not_found', 'error', 'camera_error'].includes(status);

  if (!visible) return null;

  // ── Styles ──────────────────────────────────────────────────

  const sheetStyle = isMobile ? {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
    maxWidth: 600, marginLeft: 'auto', marginRight: 'auto',
    background: 'var(--surface)', borderRadius: '20px 20px 0 0',
    maxHeight: '92vh', overflowY: 'auto',
    transform: animOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
  } : {
    position: 'fixed', top: '50%', left: '50%', zIndex: 1000,
    width: '90%', maxWidth: 460, background: 'var(--surface)',
    borderRadius: 16, maxHeight: '85vh', overflowY: 'auto',
    opacity: animOpen ? 1 : 0,
    transform: animOpen ? 'translate(-50%, -50%)' : 'translate(-50%, calc(-50% - 16px))',
    transition: 'opacity 0.22s ease, transform 0.25s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '0 8px 48px rgba(0,0,0,0.22)',
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.45)',
          opacity: animOpen ? 1 : 0,
          pointerEvents: animOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s',
        }}
      />

      {/* Sheet */}
      <div style={sheetStyle}>
        {/* Handle (mobile) */}
        {isMobile && (
          <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border)' }} />
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px' }}>
          <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>Escanear producto</p>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-3)', padding: 4 }}
          >✕</button>
        </div>

        <div style={{ padding: '0 20px 28px' }}>

          {/* ── SCANNING ───────────────────────────────────── */}
          {status === 'scanning' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', marginBottom: 10 }}>
                <div id={READER_ID} style={{ width: '100%' }} />
                {/* Overlay: focus rect + scan line */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', width: '72%', height: 90 }}>
                    <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(45,106,79,0.9)', borderRadius: 4 }} />
                    <div className="scan-line" />
                  </div>
                </div>
              </div>
              <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 13, margin: 0 }}>
                Apunta al código de barras del producto
              </p>
            </div>
          )}

          {/* ── LOADING ───────────────────────────────────── */}
          {status === 'loading' && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3, display: 'inline-block' }} />
              <p style={{ marginTop: 16, color: 'var(--text-2)', margin: '16px 0 0' }}>Buscando producto...</p>
            </div>
          )}

          {/* ── FOUND ─────────────────────────────────────── */}
          {status === 'found' && product && (
            <>
              {/* Product header */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                {product.image && (
                  <img
                    src={product.image}
                    alt={product.name}
                    style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }}
                  />
                )}
                <div>
                  <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                    <span style={{ color: '#059669', marginRight: 6 }}>✓</span>
                    {product.name}
                  </p>
                  {product.brand && (
                    <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>{product.brand}</p>
                  )}
                </div>
              </div>

              {/* Macros per 100g */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
                {[
                  { label: 'Calorías', value: product.per_100g.calories != null ? `${product.per_100g.calories} kcal` : '—' },
                  { label: 'Proteína', value: product.per_100g.protein  != null ? `${product.per_100g.protein}g`      : '—' },
                  { label: 'Carbos',   value: product.per_100g.carbs    != null ? `${product.per_100g.carbs}g`        : '—' },
                  { label: 'Grasa',    value: product.per_100g.fat      != null ? `${product.per_100g.fat}g`          : '—' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{m.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Grams input */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>¿Cuánto has comido?</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setGrams(g => Math.max(1, g - 10))}
                    style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 20, fontWeight: 600, flexShrink: 0 }}
                  >−</button>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="number"
                      min="1"
                      value={grams}
                      onChange={e => setGrams(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: 20, paddingRight: 30 }}
                    />
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 13, pointerEvents: 'none' }}>g</span>
                  </div>
                  <button
                    onClick={() => setGrams(g => g + 10)}
                    style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 20, fontWeight: 600, flexShrink: 0 }}
                  >+</button>
                </div>
                {nutrition && (
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>
                    → <strong>{nutrition.calories ?? '—'} kcal</strong>
                    {nutrition.protein != null && <span style={{ color: '#059669' }}> · {nutrition.protein}g prot</span>}
                    {nutrition.carbs   != null && <span style={{ color: '#d97706' }}> · {nutrition.carbs}g carb</span>}
                    {nutrition.fat     != null && <span style={{ color: '#3b82f6' }}> · {nutrition.fat}g grasa</span>}
                  </p>
                )}
              </div>

              <button className="btn btn-primary btn-full" onClick={handleAdd} style={{ marginBottom: 8 }}>
                Añadir al registro
              </button>
              <button className="btn btn-secondary btn-full" onClick={handleRetry}>
                Escanear otro producto
              </button>
            </>
          )}

          {/* ── NOT FOUND ─────────────────────────────────── */}
          {status === 'not_found' && (
            <div style={{ textAlign: 'center', padding: '28px 0 16px' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Producto no encontrado</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>No tenemos datos de este producto.</p>
              {lastBarcode && <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>Código: {lastBarcode}</p>}
              <button className="btn btn-secondary btn-full" onClick={handleRetry} style={{ marginBottom: 8 }}>
                Intentar de nuevo
              </button>
              <button className="btn btn-secondary btn-full" onClick={handleClose}>
                Introducir datos manualmente
              </button>
            </div>
          )}

          {/* ── ERROR ─────────────────────────────────────── */}
          {status === 'error' && (
            <div style={{ textAlign: 'center', padding: '28px 0 16px' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🌐</div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Error de conexión</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                La búsqueda está tardando más de lo normal. ¿Quieres introducir los datos manualmente?
              </p>
              <button className="btn btn-primary btn-full" onClick={handleRetry} style={{ marginBottom: 8 }}>
                Intentar de nuevo
              </button>
              <button className="btn btn-secondary btn-full" onClick={handleClose}>
                Introducir manualmente
              </button>
            </div>
          )}

          {/* ── CAMERA ERROR ──────────────────────────────── */}
          {status === 'camera_error' && (
            <div style={{ textAlign: 'center', padding: '28px 0 16px' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Sin acceso a la cámara</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                Permite el acceso en la configuración de tu navegador para usar el escáner.
              </p>
            </div>
          )}

          {/* ── MANUAL INPUT (scanning / not_found / error / camera_error) ── */}
          {showManualInput && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: status === 'scanning' ? 4 : 0 }}>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
                ¿No tienes el producto a mano?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  placeholder="8410128001108"
                  value={manualBarcode}
                  onChange={e => setManualBarcode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleManualSearch(); }}
                  style={{ flex: 1, fontSize: 14 }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleManualSearch}
                  disabled={!manualBarcode.trim()}
                >
                  Buscar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
