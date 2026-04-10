# Testing

---

## Stack de Tests

| Herramienta | Uso | Ubicacion |
|------------|-----|-----------|
| Vitest | Tests unitarios (worker + client) | `worker/src/**/__tests__/`, `client/src/utils/__tests__/` |
| Playwright | Tests E2E (contra produccion) | `client/e2e/` |

---

## Tests Unitarios del Worker

### Ejecucion
```bash
cd worker && npm test        # run all
cd worker && npm run test -- --watch  # watch mode
```

### Archivos de Test

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `routes/__tests__/api.test.js` | ~23 | Auth: register, login, refresh, tokens, rate limits, CSRF |
| `routes/__tests__/entries.test.js` | ~27 | CRUD entradas, validacion (calorias, macros, fechas), rate limits, autorizacion |
| `routes/__tests__/progress.test.js` | ~48 | Summary (30d), chart (7/30/90), advanced (Pro), proyecciones, streak, adherencia |
| `routes/__tests__/stripe.test.js` | ~14 | Checkout session, webhook signature, subscription status, access level |
| `routes/assistant.test.js` | ~23 | Conversaciones, mensajes, limites diarios por nivel, contexto, digest |
| `utils/__tests__/calibration.test.js` | ~10 | Bias, ponderacion, meal factors, food categories, frequent meals |

**Total**: ~145+ tests

### Patron de Mocking

Los tests mockean el entorno D1 de Cloudflare:
```javascript
const env = {
  DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn()
      }))
    })),
    batch: vi.fn()
  },
  JWT_SECRET: 'test-secret',
  ANTHROPIC_API_KEY: 'test-key',
  // ...
};
```

Para tests que verifican SQL con `.bind()`:
```javascript
// makeEnvTrackingBinds() captura bind calls en un array
const { env, bindCalls } = makeEnvTrackingBinds();
// Luego: expect(bindCalls).toContainEqual([userId, date]);
```

Rate limiting se mockea globalmente:
```javascript
vi.mock('../../utils.js', async () => {
  const actual = await vi.importActual('../../utils.js');
  return { ...actual, rateLimit: vi.fn(() => null) };
});
```

---

## Tests Unitarios del Cliente

### Ejecucion
```bash
cd client && npm test
```

### Archivos de Test

| Archivo | Cobertura |
|---------|-----------|
| `utils/__tests__/constants.test.js` | Constantes, MEAL_HOURS, validacion |
| `utils/__tests__/levels.test.js` | isPro, isFree, getAiLimit por nivel |
| `utils/__tests__/meals.test.js` | MEAL_TYPES, getMeal lookup |
| `utils/__tests__/tdee.test.js` | BMR, TDEE, macros, PAL, escenarios |

---

## Tests E2E (Playwright)

### Configuracion
```bash
cd client && npm run test:e2e       # headless
cd client && npm run test:e2e:ui    # con UI interactiva
```

### Config (`playwright.config.ts`)
- **Base URL**: `https://caliro.dev` (produccion real)
- **Timeout**: 30 segundos
- **Workers**: 1 (secuencial)
- **Screenshots**: solo en fallo

### Proyectos
1. **auth**: Tests de autenticacion (browser limpio, sin estado guardado)
2. **chromium**: Tests con estado autenticado (storage state persistido)

### Estructura
```
client/e2e/
├── auth.spec.ts          # login, register, logout
└── ...
```

---

## Ejecutar Todos los Tests

```bash
# Worker (unitarios)
cd worker && npm test

# Client (unitarios)
cd client && npm test

# Client (E2E)
cd client && npm run test:e2e
```

---

## Notas Importantes

1. **Los tests del worker mockean D1 completamente** — no necesitan base de datos real
2. **Los tests E2E corren contra produccion** — necesitan cuenta real y API funcionando
3. **Rate limiting se mockea en tests unitarios** para evitar falsos positivos
4. **Stripe tests verifican firmas HMAC** con secretos de test
5. **Antes de cada commit**: verificar que `cd worker && npm test` pasa los ~145 tests
