# 🧪 Entorno de Preview — Branch de Experimentos

## Objetivo
Configurar un sistema de branches de Git que permita experimentar con cambios de UI/features sin afectar NUNCA la app en producción (caliro.dev). Los usuarios existentes no verán nada hasta que se decida mergear explícitamente.

---

## REGLA ABSOLUTA DE SEGURIDAD

**El branch `main` es sagrado.**
- `main` = lo que ven los usuarios en caliro.dev
- Cualquier experimento va en un branch separado
- NUNCA hacer cambios experimentales directamente en main
- Un merge a main es una decisión consciente, nunca accidental

---

## 1. CONFIGURAR CLOUDFLARE PAGES PARA PREVIEW BRANCHES

### En Cloudflare Dashboard:
1. Ir a Workers & Pages → calorie-app → Settings → Builds & deployments
2. En "Branch deployments" verificar que está activado "All branches"
3. Esto hace que cualquier branch que se suba a GitHub se despliegue automáticamente en una URL de preview

### URL resultante:
```
main branch:           caliro.dev  (PRODUCCIÓN — intocable)
ui-experiments branch: ui-experiments.calorie-app.pages.dev  (PREVIEW)
cualquier-branch:      cualquier-branch.calorie-app.pages.dev
```

---

## 2. CREAR EL BRANCH DE EXPERIMENTOS

Ejecutar en la terminal del proyecto:

```bash
cd C:\Users\osesa\proyectos\calorie-app

# Asegurarse de estar en main y actualizado
git checkout main
git pull origin main

# Crear branch de experimentos
git checkout -b ui-experiments

# Verificar que estamos en el branch correcto
git branch --show-current
# Debe mostrar: ui-experiments
```

---

## 3. ARCHIVO DE CONFIGURACIÓN — Protección de producción

Crear `.github/branch-protection.md` (solo documentación, no código):

```markdown
# Reglas de branches — LucaEats

## main (PRODUCCIÓN)
- URL: caliro.dev
- NUNCA pushear experimentos directamente aquí
- Solo merges conscientes desde branches probados

## ui-experiments (PREVIEW)
- URL: ui-experiments.calorie-app.pages.dev
- Para experimentos de UI y nuevas features
- Libre para romper cosas

## Crear un nuevo branch de experimento:
git checkout main
git pull origin main
git checkout -b nombre-del-experimento
git push origin nombre-del-experimento
```

---

## 4. SEPARAR VARIABLES DE ENTORNO POR ENTORNO

En Cloudflare Pages, configurar variables distintas por branch para que el preview NO comparta datos con producción si se quiere máximo aislamiento.

### En Cloudflare Dashboard:
Workers & Pages → calorie-app → Settings → Environment variables

**Production (main):**
```
VITE_API_URL = https://calorie-app-api.lucatuille.workers.dev
VITE_ENV = production
```

**Preview (todos los demás branches):**
```
VITE_API_URL = https://calorie-app-api.lucatuille.workers.dev
VITE_ENV = preview
```

Por ahora comparten el mismo Worker y BD — suficiente para experimentos de UI. Si en el futuro se quiere BD separada, se crea un Worker de staging.

---

## 5. INDICADOR VISUAL EN PREVIEW

Para que NUNCA confundas el preview con producción, añadir un banner visible solo en entorno preview.

En `client/src/App.jsx`, añadir al inicio del componente:

```jsx
{import.meta.env.VITE_ENV === 'preview' && (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    background: '#e76f51',
    color: 'white',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px',
    zIndex: 99999,
    fontFamily: 'DM Sans, sans-serif',
    letterSpacing: '0.5px',
  }}>
    ⚗️ PREVIEW — Los cambios aquí no afectan a caliro.dev
  </div>
)}
```

Barra naranja fina en la parte superior. Imposible confundir con producción.

---

## 6. WORKFLOW DIARIO DE TRABAJO

### Para experimentar:
```bash
# 1. Asegurarse de estar en el branch de experimentos
git checkout ui-experiments

# 2. Trabajar en local (localhost:5173)
npm run dev

# 3. Cuando quieras ver en móvil real:
git add .
git commit -m "experimento: descripción del cambio"
git push origin ui-experiments
# → En 2 minutos disponible en ui-experiments.calorie-app.pages.dev

# 4. Probar en móvil abriendo ui-experiments.calorie-app.pages.dev
```

### Para llevar un experimento a producción:
```bash
# SOLO cuando estés seguro de que funciona bien
git checkout main
git merge ui-experiments
git push origin main
# → caliro.dev se actualiza en 2 minutos
```

### Para descartar un experimento:
```bash
# Volver a main sin mergear nada
git checkout main
# El branch ui-experiments sigue existiendo con sus cambios
# pero main (producción) no se ha tocado
```

### Para empezar un experimento desde cero:
```bash
git checkout main
git pull origin main
git checkout -b nuevo-experimento
```

---

## 7. MANTENER EL BRANCH ACTUALIZADO CON MAIN

Cuando main recibe updates (bugfixes, etc.) y quieres tenerlos también en el branch de experimentos:

```bash
git checkout ui-experiments
git merge main
# Resuelve conflictos si los hay
git push origin ui-experiments
```

---

## 8. MÚLTIPLES BRANCHES SIMULTÁNEOS

Si en el futuro quieres tener varios experimentos en paralelo:

```
main                    → caliro.dev
ui-experiments          → ui-experiments.calorie-app.pages.dev
stripe-integration      → stripe-integration.calorie-app.pages.dev
assistant-redesign      → assistant-redesign.calorie-app.pages.dev
```

Cada uno con su URL de preview. Cloudflare los despliega todos automáticamente.

---

## 9. LO QUE NUNCA PUEDE PASAR

```
❌ git push origin main  (desde un branch de experimentos)
❌ Hacer cambios directamente en main sin probar antes
❌ Mergear algo sin haberlo probado en la URL de preview
```

Para prevenir pushes accidentales a main, configurar en GitHub:
Settings → Branches → Add branch protection rule → main
Marcar "Require pull request before merging"

Así es imposible hacer push directo a main — siempre hay que crear un PR consciente.

---

## 10. AL FINALIZAR ESTE SETUP

1. Verificar que `git branch --show-current` muestra `ui-experiments`
2. Hacer un cambio pequeño (ej: cambiar un color en global.css)
3. `git add . && git commit -m "test: verificar preview deployment" && git push origin ui-experiments`
4. Esperar 2 minutos y abrir `ui-experiments.calorie-app.pages.dev`
5. Verificar que el banner naranja "PREVIEW" aparece arriba
6. Verificar que `caliro.dev` NO tiene el cambio de color
7. Si todo funciona → el sistema está listo para experimentar

