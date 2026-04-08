# Caliro iOS — Sprint Capacitor

> **Estado actual:** Fase 1 completada en Windows. Toda la preparación está hecha.
> Cuando tengas tiempo en la Mac, sigue la **Fase 2** abajo. Tarda ~1 día.

---

## Arquitectura

- **Capacitor** dentro de `client/` (no en carpeta separada)
- **Bundle ID:** `dev.caliro.app`
- **App name:** `Caliro`
- **webDir:** `dist/app` (lo que produce el build de Vite + post-build)
- **Detección de plataforma:** `client/src/utils/platform.ts` → `isNative()`, `isIOS()`, `openExternal()`

La PWA web sigue funcionando exactamente igual. Toda la lógica nueva está detrás de `if (isNative())` que en web siempre evalúa `false` y Vite hace tree-shaking.

---

## 🔍 Cómo encontrar TODOs pendientes

Todos los lugares donde se ha dejado código "a medias" están marcados con:

```
TODO(capacitor-mac-sprint):
```

Para listarlos todos:

```bash
cd client && grep -rn "TODO(capacitor-mac-sprint)" src/
```

Esto es fundamental — el debugging se vuelve trivial porque todo lo pendiente está marcado uniformemente.

---

## ⚠️ Cosas que NO funcionan en iOS todavía (intencionalmente)

Estas se han dejado para el sprint Mac. Están todas marcadas con `TODO(capacitor-mac-sprint)`:

| Feature | Estado iOS | Sprint Mac TODO |
|---------|-----------|-----------------|
| **Suscripción Pro (upgrade)** | Pantalla "Próximamente" | Implementar Apple IAP con RevenueCat |
| **Gestionar suscripción Stripe** | Botón oculto | Distinguir origen del pago (stripe vs apple) en backend |
| **Escáner de códigos de barras** | Modal "Próximamente" | Sustituir por `@capacitor-mlkit/barcode-scanning` |
| **Foto IA (cámara nativa)** | Funciona con `<input type="file">` (UX subóptima) | Mejorar con `@capacitor/camera` plugin |
| **Iconos** | Placeholder (Capacitor default) | Crear `icon-1024.png` real y ejecutar `npm run ios:icons` |
| **Splash screen** | Color sólido cream | Diseñar splash con logo y exportar a 2732x2732 |
| **Push notifications** | No implementadas | Considerar para futuro sprint |
| **Sign in with Apple** | No implementado | Solo necesario si añadimos Google/Facebook login |

---

## FASE 2: Setup en Mac (~1 día de trabajo)

### Pre-requisitos en la Mac
- macOS 13+ con Xcode 15+
- Node.js ≥18 (o usar `nvm`)
- CocoaPods: `sudo gem install cocoapods`
- Apple Developer account ($99/año, NO necesario para simulador)
- iPhone físico con cable USB (recomendado para testing real)

### Pasos

```bash
# 1. Clonar y instalar
git clone <repo>
cd calorie-app/client
npm install

# 2. Build del cliente web
npm run build
# Esto genera dist/app/ con todo el SPA listo para wrappear

# 3. Crear el proyecto iOS (SOLO LA PRIMERA VEZ)
npx cap add ios
# Esto crea la carpeta client/ios/ con un proyecto Xcode completo

# 4. Sincronizar el web build con iOS
npx cap sync ios
# Esto copia dist/app/ a ios/App/App/public/

# 5. Generar iconos (opcional, requiere icon-1024.png en client/ios-assets/)
npm run ios:icons
# Lee client/ios-assets/icon-1024.png y genera todos los tamaños iOS
# Luego en Xcode: drag AppIcon.appiconset al Assets.xcassets

# 6. Editar Info.plist con permisos de cámara/fotos
#    Abre client/ios/App/App/Info.plist en Xcode (click derecho → Open As → Source Code)
#    Pega las claves de client/ios-templates/Info.plist.additions.xml entre <dict> ... </dict>

# 7. Abrir Xcode
npx cap open ios
```

### En Xcode (manual, no se puede automatizar)

1. **Signing & Capabilities:**
   - Selecciona el target "App"
   - Tab "Signing & Capabilities"
   - Team: tu Apple Developer team
   - Bundle Identifier debe ser `dev.caliro.app` (ya configurado en `capacitor.config.ts`)
   - Click "+ Capability" → añade In-App Purchase (necesario cuando implementes IAP)

2. **Verifica el Info.plist:**
   - Que tenga `NSCameraUsageDescription`
   - Que tenga `NSPhotoLibraryUsageDescription`
   - Que tenga `ITSAppUsesNonExemptEncryption` = NO

3. **Probar en simulador:**
   - Selecciona un simulador (iPhone 15 Pro Max recomendado)
   - Cmd+R para correr
   - Verifica: login, dashboard, calculator (foto), asistente, perfil, eliminar cuenta, exportar GDPR

4. **Probar en iPhone físico:**
   - Conecta el iPhone con cable
   - Selecciónalo en Xcode (top bar)
   - Cmd+R
   - En el iPhone: Settings → General → VPN & Device Management → Confía en tu certificado
   - Probar todo otra vez

5. **Si todo va bien — commit la carpeta `ios/`:**
   ```bash
   git add ios/
   git commit -m "feat(ios): initial Xcode project from npx cap add ios"
   git push
   ```

---

## Workflow día-a-día (Windows ↔ Mac)

### Cuando cambias código en Windows
```bash
# Trabajas normal
git add . && git commit -m "..." && git push
```

### Cuando vas a la Mac
```bash
git pull
cd client
npm install                  # solo si cambió package.json
npm run build:mobile         # build + cap sync ios
npx cap open ios             # abre Xcode → Cmd+R
```

`build:mobile` hace:
1. `vite build` — produce `dist/app/`
2. `node scripts/post-build.js` — mueve `app.html` → `app/index.html`
3. `cap sync ios` — copia `dist/app/` a `ios/App/App/public/` y actualiza plugins

---

## Garantías de no-regresión web

La web sigue funcionando exactamente igual. Por diseño:

1. `isNative()` no importa Capacitor — detección runtime sin acoplamiento
2. Capacitor está en `devDependencies`, no `dependencies`
3. Todos los plugins se importan con `await import()` lazy SOLO dentro de `if (isNative())`
4. Vite hace tree-shaking de las ramas isNative en build web
5. Cloudflare Pages sigue desplegando solo `dist/`, ignora `ios/`
6. Service worker sigue funcionando en web (solo se desactiva en Capacitor)
7. Los 165 tests del worker no se han tocado

Tras cualquier cambio significativo, smoke test obligatorio:
```bash
cd client && npm run build && npm run dev
# En el browser:
# - window.Capacitor → undefined
# - login funciona
# - calculator + foto funciona
# - asistente funciona
# - profile + export JSON funciona
# - eliminar cuenta (con cuenta de prueba) funciona
```

---

## Recursos

- [Capacitor docs](https://capacitorjs.com/docs)
- [Capacitor iOS guide](https://capacitorjs.com/docs/ios)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Apple Developer](https://developer.apple.com)
- [RevenueCat docs](https://www.revenuecat.com/docs) — para IAP
