# 📦 Escáner de Código de Barras — Open Food Facts

## Contexto
Añadir un botón de escáner de código de barras en la página de Registrar (`Calculator.jsx`), al lado del botón existente de "📸 Foto". Al escanear, se consulta la API gratuita de Open Food Facts y se pre-rellena el formulario con los datos nutricionales del producto. Sin backend — todo desde el frontend.

---

## 1. INSTALAR LIBRERÍA

```bash
cd client
npm install html5-qrcode
```

---

## 2. UI — Dónde y cómo aparece el botón

### Posición actual de los botones en `Calculator.jsx`:
```
Añadir comida                    [📸 Foto]

[🌅 Desayuno] [☀️ Comida] [🌙 Cena]
[🍎 Snack] [🍽️ Otro]
```

### Posición nueva con el escáner:
```
Añadir comida          [📸 Foto]  [▦ Escanear]

[🌅 Desayuno] [☀️ Comida] [🌙 Cena]
[🍎 Snack] [🍽️ Otro]
```

### Diseño del botón "Escanear":
- Mismo tamaño y estilo que el botón de Foto — coherencia visual total
- Icono: un SVG de código de barras inline (no emoji) — más profesional
- Texto: "Escanear"
- Fondo: `var(--surface)`, borde `1px solid var(--border)`, border-radius igual que el de Foto
- En hover: mismo efecto que el botón de Foto
- En modo oscuro: adaptar automáticamente con variables CSS

```jsx
// El icono SVG de código de barras (inline, sin dependencias):
const BarcodeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="1" y="4" width="2" height="16"/>
    <rect x="5" y="4" width="1" height="16"/>
    <rect x="8" y="4" width="2" height="16"/>
    <rect x="12" y="4" width="1" height="16"/>
    <rect x="15" y="4" width="3" height="16"/>
    <rect x="20" y="4" width="2" height="16"/>
  </svg>
);
```

---

## 3. FLUJO COMPLETO DEL ESCÁNER

### Estado del componente:
```jsx
const [scannerOpen, setScannerOpen] = useState(false);
const [scannerStatus, setScannerStatus] = useState('idle'); 
// idle | scanning | loading | found | not_found | error
const [scannedProduct, setScannedProduct] = useState(null);
```

### Al pulsar "Escanear":
1. Abre un **bottom sheet** (mismo patrón que análisis avanzado y suplementos)
2. Inicializa la cámara con `html5-qrcode`
3. Muestra el visor de cámara con overlay de guía

### El bottom sheet del escáner:

```
─────── (handle bar) ───────

  Escanear producto              [✕]

  ┌─────────────────────────────────────┐
  │                                     │
  │         [VISOR DE CÁMARA]          │
  │                                     │
  │    ┌─────────────────────────┐      │
  │    │                         │      │  ← área de enfoque
  │    │    apunta al código     │      │
  │    │    de barras            │      │
  │    └─────────────────────────┘      │
  │                                     │
  └─────────────────────────────────────┘

  Apunta la cámara al código de barras
  del producto para escanearlo

  ─────────────────────────────────────
  ¿No tienes el producto a mano?
  [ Introducir código manualmente ]
```

### Estados visuales dentro del bottom sheet:

**Escaneando (cámara activa):**
- Visor de cámara activo
- Línea de escaneo animada (CSS, de arriba a abajo, verde `#2d6a4f`)
- Texto: "Apunta al código de barras"

**Cargando (código detectado, consultando API):**
- Parar cámara
- Spinner verde centrado
- Texto: "Buscando producto..."

**Producto encontrado:**
```
✓ Producto encontrado

[Imagen del producto si existe]

Yogur natural Danone
Danone · 125g

Calorías    61 kcal
Proteína    3.8g
Carbos      4.7g
Grasa       3.3g

¿Cuánto has comido?
[──────────── 125 ────────────] g
               ↕
       kcal calculadas: 76

[ Añadir al registro ]
[ Escanear otro producto ]
```

**Producto no encontrado:**
```
⚠️ Producto no encontrado

No tenemos datos de este producto.
Código: 8410128001108

[ Introducir datos manualmente ]
[ Intentar de nuevo ]
```

**Error de cámara (no hay permisos):**
```
📷 Sin acceso a la cámara

Permite el acceso en la configuración
de tu navegador para usar el escáner.

[ Introducir código manualmente ]
```

---

## 4. INTEGRACIÓN CON OPEN FOOD FACTS

### La llamada a la API (sin API key, completamente gratis):

```js
async function fetchProductByBarcode(barcode) {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { signal: AbortSignal.timeout(5000) } // timeout 5 segundos
    );
    
    if (!response.ok) throw new Error('Network error');
    
    const data = await response.json();
    
    if (data.status !== 1) return null; // producto no encontrado
    
    const product = data.product;
    const nutriments = product.nutriments;
    
    // Extraer datos relevantes
    return {
      barcode,
      name: product.product_name || product.product_name_es || 'Producto desconocido',
      brand: product.brands || '',
      image: product.image_front_small_url || null,
      serving_size: product.serving_size || null,
      quantity: parseFloat(product.quantity) || 100,
      quantity_unit: 'g',
      
      // Valores por 100g
      per_100g: {
        calories: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy_100g'] / 4.184 || 0),
        protein:  Math.round((nutriments['proteins_100g'] || 0) * 10) / 10,
        carbs:    Math.round((nutriments['carbohydrates_100g'] || 0) * 10) / 10,
        fat:      Math.round((nutriments['fat_100g'] || 0) * 10) / 10,
      }
    };
  } catch (error) {
    if (error.name === 'TimeoutError') return 'timeout';
    return 'error';
  }
}
```

### Cálculo dinámico según gramos introducidos:

```js
function calculateNutrition(product, grams) {
  const factor = grams / 100;
  return {
    calories: Math.round(product.per_100g.calories * factor),
    protein:  Math.round(product.per_100g.protein  * factor * 10) / 10,
    carbs:    Math.round(product.per_100g.carbs    * factor * 10) / 10,
    fat:      Math.round(product.per_100g.fat      * factor * 10) / 10,
  };
}
```

El usuario mueve el input de gramos y los macros se actualizan en tiempo real.

---

## 5. CONFIGURACIÓN DEL ESCÁNER html5-qrcode

```jsx
import { Html5Qrcode } from 'html5-qrcode';

// Al abrir el bottom sheet:
const startScanner = async () => {
  const scanner = new Html5Qrcode('barcode-reader');
  
  try {
    await scanner.start(
      { facingMode: 'environment' }, // cámara trasera
      {
        fps: 10,
        qrbox: { width: 280, height: 120 }, // formato alargado para códigos de barras
        aspectRatio: 1.5,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,  // el más común en Europa
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
        ]
      },
      async (decodedText) => {
        // Código detectado
        await scanner.stop();
        setScannerStatus('loading');
        
        const product = await fetchProductByBarcode(decodedText);
        
        if (product === null) {
          setScannerStatus('not_found');
        } else if (product === 'timeout' || product === 'error') {
          setScannerStatus('error');
        } else {
          setScannedProduct(product);
          setScannerStatus('found');
        }
      },
      () => {} // error frame — ignorar silenciosamente
    );
    
    scannerRef.current = scanner;
  } catch (err) {
    // Sin permisos de cámara
    setScannerStatus('camera_error');
  }
};

// Al cerrar el bottom sheet — IMPORTANTE: siempre parar la cámara
const closeScanner = async () => {
  if (scannerRef.current) {
    try { await scannerRef.current.stop(); } catch {}
    scannerRef.current = null;
  }
  setScannerOpen(false);
  setScannerStatus('idle');
  setScannedProduct(null);
};
```

---

## 6. AL PULSAR "AÑADIR AL REGISTRO"

Pre-rellenar el formulario de `Calculator.jsx` con los datos del producto y cerrar el bottom sheet:

```js
const handleAddScannedProduct = (product, grams) => {
  const nutrition = calculateNutrition(product, grams);
  
  // Pre-rellenar el formulario existente
  setFoodName(product.brand 
    ? `${product.name} (${product.brand})` 
    : product.name
  );
  setCalories(nutrition.calories);
  setProtein(nutrition.protein);
  setCarbs(nutrition.carbs);
  setFat(nutrition.fat);
  
  // Cerrar el escáner
  closeScanner();
  
  // Mostrar feedback sutil
  // Toast o mensaje: "✓ Producto añadido al formulario"
};
```

El usuario puede revisar y ajustar antes de guardar definitivamente — nunca guardar automáticamente sin confirmación.

---

## 7. INPUT MANUAL DE CÓDIGO

Para cuando el usuario no tiene el producto delante o la cámara falla:

```jsx
// Dentro del bottom sheet, sección inferior:
<div>
  <p>Introducir código manualmente:</p>
  <div style={{ display: 'flex', gap: '8px' }}>
    <input 
      type="number" 
      placeholder="8410128001108"
      maxLength={13}
      value={manualBarcode}
      onChange={e => setManualBarcode(e.target.value)}
    />
    <button onClick={() => handleManualBarcode(manualBarcode)}>
      Buscar
    </button>
  </div>
</div>
```

---

## 8. DETALLES DE DISEÑO

- El bottom sheet del escáner: mismo componente/estilo que el de suplementos y análisis avanzado
- La línea de escaneo animada:
```css
@keyframes scanLine {
  0%   { top: 10%; }
  100% { top: 90%; }
}
.scan-line {
  position: absolute;
  left: 0; right: 0;
  height: 2px;
  background: #2d6a4f;
  animation: scanLine 1.5s ease-in-out infinite alternate;
}
```
- El input de gramos: input numérico grande con +/- buttons a los lados
- Los macros calculados se actualizan en tiempo real con `onChange`
- La imagen del producto (si existe): 60x60px, border-radius 8px, object-fit cover
- Funciona en modo claro y oscuro — usar variables CSS siempre

---

## 9. PROBLEMAS A ABORDAR

**Problema 1 — Permisos de cámara en iOS Safari**
En Safari el primer acceso a la cámara puede requerir interacción del usuario. Asegurarse de que `startScanner()` se llama solo después de un tap explícito — nunca automáticamente al abrir el bottom sheet.

**Problema 2 — Parar la cámara al navegar**
Si el usuario cierra el bottom sheet sin usar el botón X (por ejemplo con el botón atrás del móvil), la cámara debe pararse. Usar `useEffect` cleanup:
```js
useEffect(() => {
  return () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }
  };
}, []);
```

**Problema 3 — Producto sin datos completos**
Algunos productos en Open Food Facts tienen datos incompletos. Si algún macro es null o undefined, mostrarlo como "—" y permitir al usuario introducirlo manualmente antes de guardar.

**Problema 4 — Timeout de red**
Si Open Food Facts tarda más de 5 segundos, mostrar:
"La búsqueda está tardando más de lo normal. ¿Quieres introducir los datos manualmente?"

**Problema 5 — Múltiples escaneos accidentales**
Una vez detectado un código, ignorar todos los siguientes hasta que el usuario decida escanear de nuevo. Usar un flag `isProcessing` para evitar llamadas duplicadas.

---

## 10. ORDEN DE IMPLEMENTACIÓN

1. `npm install html5-qrcode` en `/client`
2. Crear `client/src/components/BarcodeScanner.jsx` con toda la lógica
3. Crear `client/src/utils/openfoodfacts.js` con `fetchProductByBarcode` y `calculateNutrition`
4. Añadir botón "Escanear" en `Calculator.jsx` al lado del botón Foto
5. Integrar `BarcodeScanner` en `Calculator.jsx`
6. Verificar que al añadir un producto escaneado pre-rellena correctamente el formulario
7. Probar en móvil real — el escáner solo funciona bien en dispositivo físico

---

## 11. AL FINALIZAR

- Probar con un producto real de supermercado (EAN-13, el código de barras estándar europeo)
- Probar con un producto no encontrado — debe mostrar el mensaje correcto
- Probar cerrar el bottom sheet a mitad de escaneo — la cámara debe pararse
- Verificar que los macros calculados coinciden con los de la etiqueta del producto
- `git add . && git commit -m "feat: escáner de código de barras con Open Food Facts" && git push`
- Marcar en ROADMAP.md como completado
