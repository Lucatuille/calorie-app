import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/* ─── Shared sub-components ─── */

function HeroBanner({ num, title, subtitle, color, textColor }) {
  return (
    <div style={{
      background: color,
      height: 100,
      padding: '0 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      borderRadius: 14,
      margin: '14px 18px',
    }}>
      <span style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: 26,
        color: textColor,
        lineHeight: 1.15,
        marginBottom: 4,
      }}>{title}</span>
      <span style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        color: textColor,
        opacity: 0.65,
        marginTop: 0,
      }}>{subtitle}</span>
    </div>
  );
}

function DemoBox({ children }) {
  return (
    <div style={{
      background: '#F5F2EE',
      borderRadius: 14,
      padding: 14,
      margin: '0 16px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 10,
        padding: 14,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {children}
      </div>
    </div>
  );
}

function TipStrip({ text }) {
  return (
    <div style={{
      margin: '16px 16px 20px',
      padding: '10px 12px',
      borderLeft: '3px solid #22c55e',
      background: '#f0fdf4',
      borderRadius: '0 8px 8px 0',
      fontSize: 12,
      lineHeight: 1.5,
      color: '#15803d',
    }}>
      {text}
    </div>
  );
}

function IntroText({ text }) {
  return (
    <p style={{
      fontSize: 13,
      lineHeight: 1.6,
      color: 'var(--text-secondary)',
      margin: '14px 16px 14px',
    }}>
      {text}
    </p>
  );
}

function StepCard({ number, title, body }) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      padding: '10px 0',
    }}>
      <div style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: '#111',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>{number}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1, #111)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  );
}

/* ─── Page Components ─── */

function Page1() {
  const [selected, setSelected] = useState(0);
  const [openTip, setOpenTip] = useState(-1);

  const methods = [
    { icon: '📷', label: 'Foto IA' },
    { icon: '≡', label: 'Escanear' },
    { icon: '✏', label: 'Describir' },
  ];

  const descriptions = [
    'Haz una foto al plato. La IA reconoce comida española real — tortilla, bocadillos, paella — y devuelve calorías y macros en segundos. Añade texto descriptivo para mayor precisión.',
    'Para productos envasados. Apunta la cámara al código de barras y obtén los datos nutricionales exactos del fabricante. La opción más precisa — 100% exacto.',
    'Escribe lo que comiste en texto libre. «Dos huevos fritos con jamón serrano» funciona perfectamente. Cuanto más específico, más precisa la estimación.',
  ];

  const proTips = [
    {
      title: '📷 Foto IA: más contexto = más precisión',
      body: 'Combina la foto con una descripción de texto. Por ejemplo, si fotografías un plato de pasta, añade «pasta con salsa boloñesa casera, unos 300g». La IA combina ambas fuentes y la estimación mejora significativamente.',
    },
    {
      title: '✏ Descripción: sé específico',
      body: '«Ensalada» puede ser 150 o 600 kcal. «Ensalada mixta grande con atún, maíz, aceite de oliva y pan» le da a la IA toda la información que necesita. Incluye cantidades aproximadas y métodos de cocción cuando puedas.',
    },
    {
      title: '≡ Envasados: siempre el escáner',
      body: 'Si el producto tiene código de barras, usa el escáner siempre. Los datos vienen directamente del fabricante y son 100% exactos. La foto o descripción siempre serán una estimación — el escáner no.',
    },
  ];

  return (
    <>
      <HeroBanner num="01" title="Registrar" subtitle="Foto, escáner o texto libre" color="#dcfce7" textColor="#15803d" />
      <IntroText text="Tres formas de añadir lo que comes. Cada una tiene su caso de uso ideal. Toca cada método para ver cuándo usarlo." />
      <DemoBox>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {methods.map((m, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              style={{
                flex: 1,
                padding: '10px 6px',
                borderRadius: 10,
                border: selected === i ? '1.5px solid #22c55e' : '1px solid var(--border)',
                background: selected === i ? '#f0fdf4' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: selected === i ? 600 : 400,
                color: 'var(--text-1, #111)',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 18 }}>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
        <div style={{
          background: '#F5F2EE',
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
        }}>
          {descriptions[selected]}
        </div>
      </DemoBox>

      <div style={{ margin: '14px 16px 0' }}>
        {proTips.map((tip, i) => (
          <div key={i} style={{ borderBottom: i < 2 ? '0.5px solid var(--border)' : 'none' }}>
            <button
              onClick={() => setOpenTip(openTip === i ? -1 : i)}
              style={{
                width: '100%',
                padding: '12px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-1, #111)',
                textAlign: 'left',
              }}
            >
              {tip.title}
              <span style={{
                transform: openTip === i ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
                fontSize: 12,
                opacity: 0.4,
              }}>▼</span>
            </button>
            {openTip === i && (
              <div style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                paddingBottom: 12,
              }}>
                {tip.body}
              </div>
            )}
          </div>
        ))}
      </div>

      <TipStrip text="Corrige las estimaciones si no son exactas — el motor de calibración aprende de cada corrección que hagas y mejora con el tiempo." />
    </>
  );
}

function Page2() {
  const [val, setVal] = useState(0);

  const conf1 = Math.min(95, 40 + val * 2.5);
  const conf2 = Math.min(92, 35 + val * 2.8);
  const global = Math.min(92, 30 + val * 3.1);
  const est1 = val > 10 ? '358 kcal' : val > 5 ? '368 kcal' : '~385 kcal';
  const est2 = val > 10 ? '492 kcal' : val > 5 ? '508 kcal' : '~525 kcal';

  const categories = [
    { name: 'Huevos y tortillas', pct: 78, bg: '#fef3c7' },
    { name: 'Carnes y pescados', pct: 65, bg: '#dcfce7' },
    { name: 'Pasta y arroces', pct: 32, bg: '#e0f2fe' },
    { name: 'Verduras y ensaladas', pct: 45, bg: '#fce7f3' },
  ];

  return (
    <>
      <HeroBanner num="02" title="Calibración" subtitle="La IA que aprende cómo comes tú" color="#ede9fe" textColor="#5b21b6" />
      <IntroText text="La IA aprende de cada corrección que haces. Arrastra el slider para ver cómo mejora la precisión del motor a medida que lo usas." />
      <DemoBox>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1, #111)', marginBottom: 8 }}>
            Correcciones realizadas: {val}
          </div>
          <input
            type="range"
            min={0}
            max={20}
            value={val}
            onChange={e => setVal(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#22c55e' }}
          />
        </div>

        {[
          { name: 'Tortilla española', est: est1, conf: conf1 },
          { name: 'Pasta boloñesa', est: est2, conf: conf2 },
        ].map((food, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderTop: i === 0 ? '0.5px solid var(--border)' : 'none',
            borderBottom: '0.5px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1, #111)' }}>{food.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{food.est}</div>
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: food.conf > 70 ? '#15803d' : food.conf > 50 ? '#92400e' : '#6b7280',
            }}>
              {Math.round(food.conf)}%
            </div>
          </div>
        ))}

        <div style={{ marginTop: 14 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            marginBottom: 6,
          }}>
            <span style={{ fontWeight: 500, color: 'var(--text-1, #111)' }}>Precisión global del motor</span>
            <span style={{ fontWeight: 700, color: '#22c55e' }}>{Math.round(global)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#e5e7eb' }}>
            <div style={{
              height: '100%',
              borderRadius: 3,
              background: '#22c55e',
              width: `${Math.round(global)}%`,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      </DemoBox>

      <div style={{ margin: '14px 16px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1, #111)', marginBottom: 2 }}>
          El motor aprende por categorías
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Corregir tortilla mejora huevos y frituras — no la pasta
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {categories.map((cat, i) => (
            <div key={i} style={{
              background: cat.bg,
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#111', marginBottom: 4 }}>{cat.name}</div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.08)' }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'rgba(0,0,0,0.2)', width: `${cat.pct}%` }} />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 3 }}>{cat.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      <TipStrip text="La pasta y el arroz tienden a subestimarse visualmente. Corrígelos las primeras veces para calibrar esas categorías rápidamente." />
    </>
  );
}

function Page3() {
  const [activeQ, setActiveQ] = useState(0);

  const questions = [
    '¿Cómo voy hoy?',
    '¿Qué debería cenar?',
    'Mis patrones',
    '¿Por qué no bajo de peso?',
  ];

  const replies = [
    `<strong>Llevas 820 kcal hoy</strong> con desayuno y almuerzo registrados.<br/><br/>Te quedan <strong>992 kcal</strong> para la cena y posibles snacks. En macros estás bien de proteína (62g de 140g objetivo) pero algo bajo en grasa saludable. Una cena con pescado o aguacate equilibraría el día.`,
    `Basándome en lo que llevas hoy (<strong>820 kcal, 62g proteína</strong>), te sugiero algo con <strong>~900 kcal y alto en proteína</strong>:<br/><br/>• <strong>Salmón a la plancha</strong> con patata asada y ensalada — ~650 kcal, 45g prot<br/>• <strong>Pollo al horno</strong> con verduras y arroz — ~700 kcal, 50g prot<br/><br/>Cualquiera te deja margen para un snack ligero después.`,
    `Analizando tus últimas 4 semanas:<br/><br/>• <strong>Desayuno:</strong> muy consistente (~350 kcal). Siempre registrado.<br/>• <strong>Almuerzo:</strong> el más variable (400-900 kcal). Los viernes subes ~200 kcal extra.<br/>• <strong>Cena:</strong> tiendes a subestimar — tus correcciones suben la cena un 15% de media.<br/>• <strong>Weekends:</strong> +320 kcal de media vs entre semana.`,
    `Tu adherencia calórica es del <strong>71%</strong> — está bien, pero los fines de semana la rompes casi siempre.<br/><br/>Datos clave:<br/>• Promedio L-V: <strong>1.780 kcal</strong> (dentro de objetivo)<br/>• Promedio S-D: <strong>2.340 kcal</strong> (560 kcal sobre objetivo)<br/>• Eso anula ~2 días de déficit cada semana.<br/><br/>Si mantuvieras el fin de semana en ~2.000 kcal, tu proyección pasaría de −0.2 a <strong>−0.5 kg/semana</strong>.`,
  ];

  return (
    <>
      <HeroBanner num="03" title="Asistente" subtitle="No es un chatbot genérico" color="#fef3c7" textColor="#92400e" />
      <IntroText text="El asistente tiene acceso a tu historial completo y responde con tus datos reales. Toca una pregunta para ver cómo responde." />
      <div style={{ margin: '0 16px 12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', gap: 8, paddingBottom: 4, whiteSpace: 'nowrap' }}>
          {questions.map((q, i) => (
            <button
              key={i}
              onClick={() => setActiveQ(i)}
              style={{
                padding: '7px 14px',
                borderRadius: 100,
                border: activeQ === i ? 'none' : '1px solid var(--border)',
                background: activeQ === i ? '#111' : 'var(--surface-2)',
                color: activeQ === i ? '#fff' : 'var(--text-1, #111)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
      <div style={{ margin: '0 16px' }}>
        <div style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: '12px 12px 12px 3px',
          padding: '10px 12px',
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--text-1, #111)',
        }}>
          <div dangerouslySetInnerHTML={{ __html: replies[activeQ] }} />
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginTop: 8,
          lineHeight: 1.5,
        }}>
          El asistente tiene acceso a tu historial completo — responde con tus datos reales, no con consejos genéricos.
        </div>
      </div>
      <TipStrip text="Cuanto más específica la pregunta, mejor la respuesta. «¿Qué debería cenar para llegar a mi objetivo de proteína hoy?» es mejor que «¿qué ceno?»" />
    </>
  );
}

function Page4() {
  const [toast, setToast] = useState(null);

  const days = [
    { label: 'Hoy · Viernes', kcal: 620, target: 1812, foods: 'Arroz japonés · Sopa miso', over: false },
    { label: 'Ayer · Jueves', kcal: 1654, target: 1812, foods: 'Pollo · Ensalada · Bocadillo', over: false },
    { label: 'Miércoles', kcal: 1820, target: 1812, foods: 'Tortilla · Pasta · Plátano', over: true },
  ];

  const handleAdd = (dayLabel) => {
    setToast(`Añadiendo comida para ${dayLabel}...`);
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <>
      <HeroBanner num="04" title="Historial" subtitle="Edita cualquier día anterior" color="#fce7f3" textColor="#9d174d" />
      <IntroText text="Añade comidas a días anteriores o edita entradas existentes. Toca el «+» de cualquier día para probarlo." />
      <DemoBox>
        {days.map((day, i) => {
          const pct = Math.min(100, Math.round((day.kcal / day.target) * 100));
          const barColor = day.over ? '#ef4444' : '#22c55e';
          return (
            <div key={i} style={{
              padding: '10px 0',
              borderBottom: i < days.length - 1 ? '0.5px solid var(--border)' : 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1, #111)' }}>{day.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: day.over ? '#ef4444' : 'var(--text-secondary)' }}>
                    {day.kcal}/{day.target} kcal
                  </span>
                  <button
                    onClick={() => handleAdd(day.label)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      border: 'none',
                      background: '#22c55e',
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >+</button>
                </div>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', marginBottom: 4 }}>
                <div style={{ height: '100%', borderRadius: 2, background: barColor, width: `${pct}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{day.foods}</div>
            </div>
          );
        })}
      </DemoBox>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#15803d',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 100,
          fontSize: 13,
          fontWeight: 500,
          zIndex: 200,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast}
        </div>
      )}

      <div style={{
        margin: '14px 16px 0',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🍽</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1, #111)', marginBottom: 2 }}>
            ¿Comiste fuera sin el móvil?
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Puedes registrar esa comida después. Entra en el día correspondiente y añádela con foto, descripción o escáner. Tu historial queda completo y el asistente tiene toda la información.
          </div>
        </div>
      </div>

      <TipStrip text="Puedes añadir comidas a cualquier día de los últimos 30 días. Cuanto más completo sea tu historial, mejores las recomendaciones del asistente." />
    </>
  );
}

function Page5() {
  const weights = [70.8, 70.5, 70.7, 70.4, 70.2, 70.0, 69.8];
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const minW = 69.5;
  const maxW = 71.0;
  const rangeW = maxW - minW;
  const padTop = 14;
  const padBottom = 18;
  const chartH = 100 - padTop - padBottom;

  const points = weights.map((w, i) => {
    const x = 20 + i * (240 / 6);
    const y = padTop + chartH - ((w - minW) / rangeW) * chartH;
    return { x, y, w };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <>
      <HeroBanner num="05" title="Progreso" subtitle="Tu evolución real" color="#e0f2fe" textColor="#0369a1" />
      <IntroText text="Visualiza tu adherencia, proyección de peso y tendencia corporal. Los datos son más útiles cuanto más consistente sea tu registro diario." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '0 16px 14px' }}>
        <div style={{
          background: '#f0fdf4',
          borderRadius: 12,
          padding: '14px 12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: '#15803d', fontWeight: 500, marginBottom: 4 }}>Adherencia</div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: '#15803d', lineHeight: 1 }}>5/7</div>
          <div style={{ fontSize: 11, color: '#15803d', opacity: 0.7, marginTop: 4 }}>días en objetivo</div>
        </div>
        <div style={{
          background: '#f8f8f6',
          borderRadius: 12,
          padding: '14px 12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>Proyección</div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: '#111', lineHeight: 1 }}>−0.4 kg</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7, marginTop: 4 }}>esta semana</div>
        </div>
      </div>

      <DemoBox>
        <svg viewBox="0 0 280 100" style={{ width: '100%', maxHeight: 140 }}>
          <polyline
            points={polyline}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 3} fill="#22c55e" />
          ))}
          {/* Last point label */}
          <text x={points[points.length - 1].x} y={points[points.length - 1].y - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="#22c55e">
            69.8
          </text>
          {/* X labels */}
          {labels.map((l, i) => (
            <text key={i} x={20 + i * (240 / 6)} y={94} textAnchor="middle" fontSize="9" fill="#9ca3af">
              {l}
            </text>
          ))}
        </svg>
      </DemoBox>

      <div style={{ margin: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '12px 14px',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>📊</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1, #111)', marginBottom: 2 }}>
              ¿Por qué la proyección fluctúa?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              La retención de agua, la sal, las hormonas y el contenido intestinal causan variaciones diarias de hasta 1-2 kg. La proyección usa la media móvil de 7 días para filtrar ese ruido y mostrarte la tendencia real.
            </div>
          </div>
        </div>
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '12px 14px',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚖</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1, #111)', marginBottom: 2 }}>
              Registrar peso cada mañana
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Pésate en ayunas después de ir al baño. No te fijes en el número del día — mira la tendencia semanal. Toca la pastilla de peso en la pantalla principal para registrarlo rápidamente.
            </div>
          </div>
        </div>
      </div>

      <TipStrip text="Mira la tendencia semanal, no el número de cada día. Una bajada real de 0.5 kg a la semana es excelente aunque el día a día fluctúe." />
    </>
  );
}

function Page6() {
  const [taken, setTaken] = useState([false, false, false]);

  const supplements = [
    { icon: '💪', name: 'Creatina' },
    { icon: '🐟', name: 'Omega 3' },
    { icon: '☀️', name: 'Vitamina D' },
  ];

  const toggle = (i) => {
    setTaken(prev => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const count = taken.filter(Boolean).length;

  return (
    <>
      <HeroBanner num="06" title="Suplementos" subtitle="Seguimiento diario automático" color="#f0fdf4" textColor="#166534" />
      <IntroText text="Añádelos una vez en el Perfil y aparecen solos cada día. Toca cada uno para marcarlo como tomado — el asistente tiene ese contexto." />
      <DemoBox>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-1, #111)',
          marginBottom: 12,
          textAlign: 'center',
        }}>
          {count}/3 tomados hoy
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {supplements.map((sup, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 8px',
                borderRadius: 12,
                border: taken[i] ? '1.5px solid #22c55e' : '1.5px solid transparent',
                background: taken[i] ? '#dcfce7' : '#F5F2EE',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 28, marginBottom: 6 }}>{sup.icon}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>{sup.name}</span>
            </button>
          ))}
        </div>
      </DemoBox>

      <div style={{
        margin: '14px 16px 0',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>⚙</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1, #111)', marginBottom: 2 }}>
            Añádelos una vez, aparecen solos
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Configura tus suplementos en Perfil y cada día aparecerán automáticamente para que los marques. No tienes que recordar añadirlos — el sistema lo hace por ti.
          </div>
        </div>
      </div>

      <TipStrip text="El asistente sabe qué suplementos has tomado hoy. Si le preguntas sobre proteína o recuperación, tiene ese contexto." />
    </>
  );
}

/* ─── Main Modal ─── */

const PAGES = [Page1, Page2, Page3, Page4, Page5, Page6];
const PAGE_TITLES = [
  'Registrar comidas',
  'Motor de calibración',
  'Asistente personal',
  'Historial',
  'Progreso',
  'Suplementos',
];

export default function HelpModal({ onClose }) {
  const [page, setPage] = useState(0);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth > 768);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => { document.body.style.overflow = prev; window.removeEventListener('resize', handleResize); };
  }, []);

  const PageComponent = PAGES[page];

  const goTo = (p) => {
    if (p >= 0 && p < PAGES.length) setPage(p);
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 100,
        display: 'flex',
        alignItems: isDesktop ? 'center' : 'flex-end',
        justifyContent: isDesktop ? 'center' : 'stretch',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: isDesktop ? '20px' : '20px 20px 0 0',
          width: '100%',
          maxWidth: isDesktop ? 480 : 'none',
          height: isDesktop ? 'auto' : '92dvh',
          maxHeight: isDesktop ? '85vh' : 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '0.5px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 18,
            color: 'var(--text-1, #111)',
          }}>
            {PAGE_TITLES[page]}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--surface-2)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <PageComponent key={page} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px env(safe-area-inset-bottom, 12px)',
          borderTop: '0.5px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
          flexShrink: 0,
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}>
          {/* Prev */}
          <button
            onClick={() => goTo(page - 1)}
            disabled={page === 0}
            style={{
              padding: '8px 18px',
              borderRadius: 10,
              border: '0.5px solid var(--border)',
              background: 'none',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-1, #111)',
              cursor: 'pointer',
              opacity: page === 0 ? 0.3 : 1,
              pointerEvents: page === 0 ? 'none' : 'auto',
              transition: 'opacity 0.2s',
            }}
          >Anterior</button>

          {/* Dots */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {PAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                style={{
                  width: i === page ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === page ? '#111' : '#d1d5db',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>

          {/* Next / Cerrar */}
          <button
            onClick={() => page === PAGES.length - 1 ? onClose() : goTo(page + 1)}
            style={{
              padding: '8px 18px',
              borderRadius: 10,
              border: 'none',
              background: '#111',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {page === PAGES.length - 1 ? 'Cerrar' : 'Siguiente'}
          </button>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
