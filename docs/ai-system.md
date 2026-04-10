# Sistema de IA

---

## Modelos Utilizados

| Modelo | ID | Uso | Coste aprox |
|--------|----|----|-------------|
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Analisis texto, fotos (Free/overflow) | $0.80/$4.00 MTok |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Fotos Pro (3/dia), digest, asistente contexto alto | Mayor |

---

## Analisis de Fotos

### Flujo Completo

```
1. Usuario sube foto → resize a 900px, JPEG 0.75
2. POST /api/analyze { image (base64), context?, meal_type?, ... }
3. Verificar auth + access_level
4. Rate limit: 10/60s user + 60/60s IP
5. Verificar limite diario (Free:3, Beta:15, Pro:30, Admin:∞)
6. Incrementar contador ANTES de llamar a Claude (atomico)
7. Seleccionar modelo:
   - Admin → Sonnet siempre
   - Pro/Founder → Sonnet si sonnet_photo_count < 3, sino Haiku
   - Free → Haiku siempre
8. Llamar a Claude con system prompt + imagen base64
9. Si stop_reason == 'max_tokens' → 422 (respuesta truncada)
10. Parsear JSON de la respuesta
11. Log tokens (async, no bloqueante)
12. Buscar similar_meal en frequent_meals del usuario
13. Si falla Claude → rollback contador
14. Return resultado + usage
```

### System Prompt (Fotos)
Instrucciones para Claude:
- Identificar ingredientes y estimar peso por componente
- Usar referencia de 100g para precision
- Considerar metodo de coccion (aceite, mantequilla, salsas)
- Devolver JSON con: `name, calories, calories_min, calories_max, protein, carbs, fat, confidence, notes, categories`
- Confidence: `alta` (plato simple, bien visible), `media` (normal), `baja` (foto borrosa, plato complejo)

---

## Analisis de Texto

### Flujo Completo

```
1. POST /api/entries/analyze-text { text, meal_type? }
2. Validar: text no vacio, max 500 chars
3. Rate limit: 15/60s user + 60/60s IP
4. Verificar limite diario (compartido con fotos)
5. Incrementar contador atomicamente
6. [Opcional] Buscar en spanish_dishes si SPANISH_DB_ENABLED=true
7. Llamar a Claude Haiku con system prompt + texto
8. Parsear JSON con items individuales + total
9. Aplicar calibracion post-proceso (si perfil existe)
10. Log tokens (async)
11. Return resultado con calibracion metadata
```

### System Prompt (Texto)
Instrucciones adicionales:
- Enfasis en cocina espanola: aceite de oliva generoso en frituras
- Peso seco vs cocido para pasta, arroz, legumbres
- Si la descripcion es ambigua, incluir `clarification_question` con `clarification_options`

### Base de Datos de Platos Espanoles
- Tabla `spanish_dishes` con ~500 platos
- Lookup fuzzy por nombre, aliases, tokens
- Si hay match, se inyecta como contexto adicional en el prompt:
  ```
  "Referencia BEDCA: Lentejas guisadas, porcion 300g, 345 kcal, confianza alta"
  ```
- Mejora la precision en platos espanoles tipicos

---

## Motor de Calibracion

### Concepto
Sistema de aprendizaje personalizado. Cada vez que el usuario corrige una estimacion de IA, el sistema aprende sus patrones de porciones.

### Datos de Entrada
Ultimas 50 correcciones del usuario (`ai_corrections`), ordenadas por fecha DESC.

### Factores Calculados

**1. Sesgo Global (global_bias)**
- Media ponderada de errores (recientes pesan mas)
- Decaimiento exponencial: `0.97^dias` (half-life ~23 dias)
- Formula mixta: combina error absoluto (comidas pequenas) + error relativo (comidas grandes)

**2. Factores por Tipo de Comida (meal_factors)**
- Grupos: breakfast, lunch, dinner, snack
- Minimo 3 muestras para activar
- Confianza: `min(samples / 8, 1)`

**3. Factores por Categoria (food_factors)**
- Normalizacion de nombres (ej: "grilled_chicken" → "pollo")
- Minimo 3 muestras
- Bias y confianza independientes por categoria

**4. Factores Temporales (time_factors)**
- weekend_extra: offset si fin de semana vs entre semana tienen sesgo diferente (>5%)

**5. Confianza General (confidence)**
- Signal efectivo: correcciones reales = 1.0, aceptadas sin cambio = 0.3
- Min 2 signals para activar, max a 12 signals
- Se reduce si correcciones recientes son aceptadas (IA ya es precisa)

### Aplicacion (`applyCalibration`)
```
factor = 1 + global_bias
if meal_confidence > 0.3: blend meal-specific bias
for each food_category: adjust by category confidence
if weekend: add weekend_extra
factor = clamp(factor, 0.75, 1.4)   // cap: -25% a +40%
return round(baseEstimate * factor)
```

### Comidas Frecuentes (frequent_meals)
- Top 20 comidas por frecuencia de correccion
- Campos: nombre, avg_kcal, veces registrada, ultima vez
- Similaridad semantica (distancia Levenshtein) para sugerencias
- Se muestra como `similar_meal` en la respuesta de analisis

### Donde Se Aplica
- **Texto**: Siempre post-proceso
- **Foto**: NO se aplica (estimaciones visuales son diferentes)
- Campos en respuesta: `calibration_applied`, `calibration_confidence`, `calibration_data_points`

---

## Asistente IA (Pro)

### Arquitectura

```
1. POST /api/assistant/send { message, conversation_id }
2. Verificar Pro access (requireProAccess)
3. Limite diario: Beta 15, Pro 30, Admin ∞
4. Burst: 10/60s
5. Cargar contexto:
   - Ligero (~800 tokens): hoy + resumen 7 dias
   - Completo (~3000+ tokens): perfil + 30 dias + macros + patrones
6. Seleccionar modelo segun contexto
7. System prompt con reglas estrictas
8. Almacenar mensaje + respuesta en BD
```

### System Prompt del Asistente
Reglas clave:
1. Solo responder sobre nutricion, dieta, ejercicio
2. Usar datos reales del usuario (calorias, peso, adherencia)
3. Respuestas en espanol, concisas, con datos concretos
4. **Nunca** dar diagnosticos medicos
5. **Detectar** posibles trastornos alimentarios → derivar a profesional
6. **Redirigir** preguntas sobre sintomas, medicacion, embarazo → medico
7. Disclaimer fijo: "Soy una herramienta de seguimiento, no un profesional sanitario"

### Digest Semanal
- `POST /api/assistant/digest` — 1 por 24 horas
- Usa Sonnet 4.6 para calidad
- Analiza ultimos 7 dias: adherencia, patrones, areas de mejora
- Almacenado en `assistant_digests`

---

## Limites de IA por Nivel

| Nivel | Fotos+Texto/dia | Sonnet fotos/dia | Asistente/dia |
|-------|-----------------|------------------|---------------|
| Free (3) | 3 | 0 | 0 (bloqueado) |
| Beta (1) | 15 | 3 | 15 |
| Pro (2) | 30 | 3 | 30 |
| Admin (99) | ilimitado | ilimitado | ilimitado |

---

## Training Data (Futuro)

Las columnas `input_text`, `input_type`, `ai_response_text` en `ai_corrections` acumulan datos para futuro fine-tuning de un modelo especializado:

- `input_text`: texto del usuario o contexto de la foto
- `input_type`: 'photo', 'text', 'barcode'
- `ai_response_text`: respuesta completa de Claude
- `user_final`: valor corregido por el usuario (ground truth)

Con suficientes correcciones, se podra entrenar un modelo que prediga las preferencias de porciones del usuario.
