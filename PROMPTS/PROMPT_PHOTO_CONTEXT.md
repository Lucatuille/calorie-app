# 📸 Mejora IA Foto — Campo de contexto adicional

## Contexto
La app ya tiene implementado el análisis de fotos con IA (Fase C). El problema es que la IA a veces estima mal las calorías porque no tiene información sobre la ración, el método de cocción, o ingredientes no visibles. Añadir un campo de texto opcional para que el usuario pueda dar contexto antes de analizar.

---

## Cambio en el Frontend — `AddEntryForm.jsx`

### UI actual (simplificada):
```
[Botón subir foto]
[Foto preview]
[Botón Analizar]
```

### UI nueva:
```
[Botón subir foto]
[Foto preview]

¿Quieres añadir contexto? (opcional)
┌─────────────────────────────────────────┐
│                                         │
└─────────────────────────────────────────┘
placeholder: "Ej: son 2 raciones, hecho en casa,
              lleva nata, 200g aproximadamente..."

[Analizar con IA]
```

### Detalles del campo de contexto:
- `<textarea>` de 2-3 líneas, redimensionable verticalmente
- Label: *"Contexto adicional (opcional)"*
- Placeholder con ejemplos reales y útiles:
  `"Ej: 'son 2 raciones', 'comida de restaurante', 'lleva nata y bacon', '200g aproximadamente'..."`
- Máximo 300 caracteres — mostrar contador `X/300`
- Solo visible cuando hay una foto cargada (ocultarlo si no hay foto)
- Diseño coherente con el resto del formulario

---

## Cambio en el Backend — Worker

### Endpoint actual (simplificado):
```js
// Recibe: { image: base64, meal_type: string }
// Manda a Claude: prompt fijo sin contexto
```

### Endpoint actualizado:
```js
// Recibe: { image: base64, meal_type: string, context: string (opcional) }

// El prompt a Claude cambia según si hay contexto o no:

const contextSection = context?.trim() 
  ? `\n\nContexto adicional proporcionado por el usuario: "${context.trim()}"\nTen en cuenta este contexto para ajustar las estimaciones, especialmente para el tamaño de la ración, método de cocción e ingredientes no visibles en la foto.`
  : '';

const prompt = `Analiza esta foto de comida y estima los valores nutricionales.
${contextSection}

Responde ÚNICAMENTE con un JSON con este formato exacto, sin texto adicional:
{
  "name": "nombre descriptivo del plato",
  "calories": número entero,
  "protein": número decimal,
  "carbs": número decimal,
  "fat": número decimal,
  "confidence": "high|medium|low",
  "notes": "observaciones breves sobre la estimación o ingredientes detectados"
}

Si el contexto menciona número de raciones, multiplica todos los valores por ese número.
Si menciona peso en gramos, úsalo para calibrar la estimación.
Si menciona ingredientes adicionales no visibles, inclúyelos en el cálculo.`;
```

---

## Cambio en `api.js`

```js
// Actualizar la llamada a analyzePhoto para incluir el contexto:
analyzePhoto: (imageBase64, mealType, context = '', token) =>
  request('POST', '/api/entries/analyze-photo', 
    { image: imageBase64, meal_type: mealType, context }, 
    token
  ),
```

---

## Cambio en el handler de análisis (donde se llama a la IA)

Asegurarse de que el campo `context` se recibe del body y se pasa al prompt como se describe arriba. Si `context` está vacío o no se envía, el comportamiento es idéntico al actual.

---

## Ejemplos de mejora con contexto

| Sin contexto | Con contexto | Diferencia |
|---|---|---|
| Pasta → 450 kcal (estimando ración media) | + "son 2 raciones" → 900 kcal | x2 exacto |
| Ensalada → 120 kcal | + "restaurante, con queso y picatostes" → 380 kcal | +260 kcal |
| Arroz con pollo → 520 kcal | + "200g de arroz, pechuga sin piel" → 480 kcal | más preciso |
| Tortilla → 280 kcal | + "lleva 3 huevos y patata" → 420 kcal | ingredientes ocultos |

---

## Orden de implementación

1. Actualizar `AddEntryForm.jsx` — añadir el textarea con contador
2. Actualizar `api.js` — pasar el `context` en la llamada
3. Actualizar el endpoint en el Worker — recibir y usar el `context` en el prompt
4. Desplegar Worker: `cd worker && npm run deploy`
5. Probar con una foto real con y sin contexto

---

## Al finalizar

- `git add . && git commit -m "feat: contexto adicional en análisis de foto con IA" && git push`
- Es un cambio no destructivo — si el usuario no escribe nada, funciona exactamente igual que antes
