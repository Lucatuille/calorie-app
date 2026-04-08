# iOS Assets

## Qué va aquí

Necesitas dos archivos creados manualmente (NO se generan automáticamente):

### 1. `icon-1024.png` (obligatorio)

- **Tamaño:** 1024x1024 px exactos
- **Formato:** PNG sin transparencia (fondo sólido)
- **Contenido:** logo de Caliro centrado, dejando ~10% de margen alrededor
- **Color de fondo recomendado:** `#F5F2EE` (cream) o `#111111` (negro)

Apple es muy estricto:
- NO usar transparencia → será rechazado
- NO usar texto pequeño → ilegible en iPhone
- NO copiar el logo de Apple ni emojis → rechazo
- El icono se redondea automáticamente, no añadas tú las esquinas redondeadas

### 2. `splash-2732x2732.png` (opcional, recomendado)

- **Tamaño:** 2732x2732 px (cubre todos los iPad/iPhone)
- **Formato:** PNG
- **Contenido:** logo centrado sobre fondo cream `#F5F2EE`
- **Padding:** mucho — el logo ocupa solo el centro ~30%

## Cómo generar todos los tamaños

Una vez tengas `icon-1024.png` aquí:

```bash
cd client && npm run ios:icons
```

Esto crea `AppIcon.appiconset/` con los 15 tamaños que pide iOS más el `Contents.json`.

## Cómo aplicar en Xcode

1. Abre `client/ios/App/App/Assets.xcassets` en Xcode
2. Borra el `AppIcon` existente (drag al trash o `Delete`)
3. Arrastra `client/ios-assets/AppIcon.appiconset/` entera al panel de Assets
4. Cmd+R para recompilar — verás el nuevo icono al instalar
