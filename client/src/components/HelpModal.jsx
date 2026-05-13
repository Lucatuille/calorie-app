import { useState, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';

/* ─── Shared sub-components ─── */

function HeroBanner({ num, title, subtitle, color, numColor }) {
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
      position: 'relative',
    }}>
      {num && (
        <span style={{
          position: 'absolute',
          top: 8,
          left: 14,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          color: numColor,
          opacity: 0.5,
        }}>{num}</span>
      )}
      <span style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: 26,
        color: '#1a1a1a',
        lineHeight: 1.15,
        marginBottom: 4,
      }}>{title}</span>
      <span style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        color: '#6b7280',
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
    { icon: '📷', label: 'Foto' },
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
      title: 'Cómo mejorar la precisión',
      body: 'Cuanto más contexto le des a la IA, más precisa la estimación. En foto, combínala con una descripción («pasta con boloñesa casera, ~300g»). En texto, sé específico con cantidades y método de cocción («ensalada mixta grande con atún, maíz, aceite de oliva y pan»). Una descripción detallada puede ahorrarte la corrección manual.',
    },
    {
      title: '≡ Envasados: siempre el escáner',
      body: 'Si el producto tiene código de barras, usa el escáner siempre. Los datos vienen directamente del fabricante y son 100% exactos. La foto o descripción siempre serán una estimación — el escáner no.',
    },
  ];

  return (
    <>
      <HeroBanner num="01" title="Registrar" subtitle="Foto, escáner o texto libre" color="#dcfce7" numColor="#166534" />
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
          <div key={i} style={{ borderBottom: i < proTips.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
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

      {/* Sub-bloque: comidas frecuentes — accelerador del registro */}
      <div style={{ margin: '18px 16px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1, #111)', marginBottom: 2 }}>
          Tus comidas habituales aparecen como sugerencias
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.55 }}>
          Tras registrar varias veces, los platos que más comes salen como chips rápidos al iniciar un registro. Un toque y listo.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { name: 'Avena con plátano', kcal: 412 },
            { name: 'Pollo con arroz', kcal: 580 },
            { name: 'Tostada con AOVE', kcal: 180 },
          ].map((meal, i) => (
            <div key={i} style={{
              padding: '5px 10px',
              borderRadius: 100,
              border: '0.5px solid var(--border)',
              background: 'var(--surface-2)',
              fontSize: 11,
              color: 'var(--text-1, #111)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span>{meal.name}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{meal.kcal} kcal</span>
            </div>
          ))}
        </div>
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
      <HeroBanner num="02" title="Calibración" subtitle="Aprende de tus correcciones" color="#dcfce7" numColor="#166534" />
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
  // 3 modos del Chef con demo interactiva en cada uno.
  const [mode, setMode] = useState('chat');

  const modes = [
    { key: 'chat',  label: 'Chat',   desc: 'Pregunta libre' },
    { key: 'day',   label: 'Día',    desc: 'Plan de hoy' },
    { key: 'week',  label: 'Semana', desc: '7 días' },
  ];

  return (
    <>
      <HeroBanner
        num="03"
        title="Chef Caliro"
        subtitle="Tres herramientas en una"
        color="#dcfce7"
        numColor="#166534"
      />
      <IntroText text="El Chef conoce tus datos: peso, objetivo, comidas frecuentes, preferencias. Toca cada modo para ver qué hace con ellos." />

      {/* Selector de modo — 3 cards estilo card stack */}
      <div style={{ margin: '0 16px 12px', display: 'flex', gap: 8 }}>
        {modes.map(m => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              style={{
                flex: 1,
                padding: '10px 10px 9px',
                borderRadius: 10,
                border: active ? 'none' : '1px solid var(--border)',
                background: active ? '#1a1a1a' : 'var(--surface-2)',
                color: active ? '#fff' : 'var(--text-1, #111)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 14,
                lineHeight: 1.1,
                marginBottom: 2,
              }}>{m.label}</div>
              <div style={{
                fontSize: 9,
                opacity: 0.6,
                letterSpacing: '0.03em',
              }}>{m.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Contenido dinámico por modo */}
      <div style={{ margin: '0 16px' }}>
        {mode === 'chat'  && <ChatDemo />}
        {mode === 'day'   && <DayDemo />}
        {mode === 'week'  && <WeekDemo />}
      </div>

      {/* Bloque bonus: resumen semanal automático */}
      <div style={{
        margin: '20px 16px 0',
        padding: '14px 16px',
        background: '#fdf9ed',
        border: '0.5px solid rgba(31,26,18,0.08)',
        borderRadius: 12,
      }}>
        <div style={{
          fontSize: 9,
          letterSpacing: '0.2em',
          color: '#1f1a12',
          fontWeight: 700,
          marginBottom: 6,
        }}>ADEMÁS · CADA DOMINGO</div>
        <div style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 16,
          color: '#1f1a12',
          marginBottom: 6,
        }}>Resumen semanal</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          El Chef te envía un análisis de tu semana cada domingo: adherencia, patrones detectados, comparativa finde vs semana, áreas de mejora. Sin metáforas, solo datos. <em>"Esta semana cubriste el target 5 de 7 días. Patrón finde: +320 kcal de media vs entre semana."</em>
        </div>
      </div>

      <TipStrip text="El Chef se alimenta de tu historial. Cuanto más consistente registras, mejores recomendaciones. Las preferencias dietéticas (alergias, vegano, etc.) son reglas duras que nunca rompe." />
    </>
  );
}

// ── Demo: modo Chat ──────────────────────────────────────────

function ChatDemo() {
  const [activeQ, setActiveQ] = useState(0);

  const questions = [
    '¿Qué ceno hoy?',
    '¿Por qué no bajo?',
    'Mis patrones',
  ];

  const replies = [
    `Llevas <strong>820 kcal</strong> con 62g de proteína. Te quedan <strong>992 kcal</strong>. Te sugiero <strong>salmón al horno con patata y ensalada</strong> (~650 kcal, 45g prot) para cerrar bien el día. Deja margen para un snack si quieres.`,
    `Tu adherencia L-V es del <strong>92%</strong>, pero S-D caes al <strong>48%</strong>. Promedio finde: +560 kcal sobre objetivo. Eso anula ~2 días de déficit cada semana. Si el finde te mantienes en 2.000 kcal, pasas de −0.2 a <strong>−0.5 kg/semana</strong>.`,
    `Últimas 4 semanas:<br/>• Desayuno muy consistente, ~350 kcal.<br/>• Comida variable (400-900). Los viernes subes ~200 kcal.<br/>• Cena: subestimas un 15% de media en tus correcciones.<br/>• Fines de semana: +320 kcal vs entre semana.`,
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => setActiveQ(i)}
            style={{
              padding: '6px 12px',
              borderRadius: 100,
              border: activeQ === i ? 'none' : '1px solid var(--border)',
              background: activeQ === i ? '#111' : 'var(--surface-2)',
              color: activeQ === i ? '#fff' : 'var(--text-1, #111)',
              fontSize: 11,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {q}
          </button>
        ))}
      </div>
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
        fontSize: 11,
        color: 'var(--text-secondary)',
        marginTop: 8,
        lineHeight: 1.5,
      }}>
        Responde con tus datos reales — no consejos genéricos de internet.
      </div>
    </>
  );
}

// ── Demo: modo Plan del día ──────────────────────────────────

function DayDemo() {
  const meals = [
    { type: 'DESAYUNO', name: 'Avena con plátano y yogur', kcal: 420, prot: 22 },
    { type: 'COMIDA',   name: 'Pechuga con arroz y brócoli', kcal: 580, prot: 48 },
    { type: 'MERIENDA', name: 'Tostada integral con atún',    kcal: 280, prot: 22 },
    { type: 'CENA',     name: 'Merluza al horno con patata',  kcal: 490, prot: 45 },
  ];
  const total = meals.reduce((s, m) => s + m.kcal, 0);
  const target = 1812;

  return (
    <>
      <div style={{
        fontSize: 11, color: 'var(--text-secondary)',
        marginBottom: 10, lineHeight: 1.5,
      }}>
        Genera 4 comidas ajustadas a tu objetivo del día. Pro = 2 planes/día.
      </div>
      <div style={{
        background: '#fdf9ed',
        borderRadius: 12,
        padding: '12px 14px',
      }}>
        {meals.map((m, i) => (
          <div key={i} style={{
            paddingBottom: i < meals.length - 1 ? 10 : 0,
            marginBottom: i < meals.length - 1 ? 10 : 0,
            borderBottom: i < meals.length - 1 ? '0.5px dashed rgba(31,26,18,0.1)' : 'none',
          }}>
            <div style={{
              fontSize: 8,
              letterSpacing: '0.2em',
              color: '#1f1a12',
              fontWeight: 700,
              marginBottom: 2,
            }}>{m.type}</div>
            <div style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 14,
              color: '#1f1a12',
              lineHeight: 1.2,
            }}>{m.name}</div>
            <div style={{
              fontSize: 10,
              color: '#1f1a12',
              fontWeight: 600,
              marginTop: 3,
              fontVariantNumeric: 'tabular-nums',
            }}>{m.kcal} kcal · {m.prot}g prot</div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 10,
        padding: '8px 12px',
        background: '#1a1a1a',
        color: '#fff',
        borderRadius: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <span style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)' }}>
          TOTAL
        </span>
        <span style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 16,
        }}>
          {total} / {target} kcal
        </span>
      </div>
    </>
  );
}

// ── Demo: modo Plan semanal ──────────────────────────────────

function WeekDemo() {
  const days = ['MAR 15', 'MIÉ 16', 'JUE 17', 'VIE 18'];
  const cells = {
    desayuno: ['Tostadas pavo', 'Avena', 'Yogur granola', 'Huevos'],
    comida:   ['Lentejas',      'Pasta atún', 'Pechuga arroz', 'Salmón'],
    cena:     ['Sopa',          'Merluza',    'Tortilla',       'Ensalada'],
  };
  const kcalByDay = [1780, 1820, 1790, 1810];

  return (
    <>
      <div style={{
        fontSize: 11, color: 'var(--text-secondary)',
        marginBottom: 10, lineHeight: 1.5,
      }}>
        Genera los días que faltan hasta el domingo, con variedad real entre ellos. Pro = 1/día.
      </div>
      <div style={{
        background: '#fdf9ed',
        borderRadius: 12,
        padding: '12px 10px',
        overflowX: 'auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '34px repeat(4, minmax(70px, 1fr))',
          gap: 4,
          minWidth: 340,
        }}>
          {/* Header row */}
          <div />
          {days.map(d => (
            <div key={d} style={{
              textAlign: 'center',
              fontSize: 8,
              letterSpacing: '0.15em',
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              padding: '4px 0',
            }}>{d}</div>
          ))}

          {/* Rows per meal type */}
          {['desayuno', 'comida', 'cena'].map(type => (
            <Fragment key={type}>
              <div style={{
                fontSize: 7,
                letterSpacing: '0.18em',
                color: '#1f1a12',
                fontWeight: 700,
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {type.toUpperCase()}
              </div>
              {cells[type].map((name, i) => (
                <div key={i} style={{
                  background: '#fff',
                  border: '0.5px solid rgba(31,26,18,0.08)',
                  borderRadius: 6,
                  padding: '5px 6px',
                  minHeight: 42,
                  fontSize: 10,
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontStyle: 'italic',
                  color: '#1f1a12',
                  lineHeight: 1.2,
                }}>
                  {name}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <div style={{
        marginTop: 10,
        padding: '8px 12px',
        background: '#1a1a1a',
        color: '#fff',
        borderRadius: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <span style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)' }}>
          MEDIA DIARIA
        </span>
        <span style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 16,
        }}>
          {Math.round(kcalByDay.reduce((s, k) => s + k, 0) / kcalByDay.length)} kcal
        </span>
      </div>
    </>
  );
}

function Page4() {
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
      <HeroBanner num="04" title="Progreso" subtitle="Tu evolución real" color="#faf4e6" numColor="#1f1a12" />
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

      <div style={{ margin: '14px 16px 0' }}>
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
              Cómo leer la proyección
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              El peso fluctúa diariamente 1-2 kg por agua, sal y hormonas — es ruido normal. La proyección filtra eso con media móvil de 7 días. Pésate en ayunas cada mañana para alimentar bien el modelo; no mires el número del día, mira la tendencia semanal.
            </div>
          </div>
        </div>
      </div>

      <TipStrip text="Mira la tendencia semanal, no el número de cada día. Una bajada real de 0.5 kg a la semana es excelente aunque el día a día fluctúe." />
    </>
  );
}

function Page5() {
  // Bloque visual reutilizable para cada apartado del perfil
  const Block = ({ icon, title, body }) => (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1, #111)', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {body}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <HeroBanner num="05" title="Tu perfil" subtitle="Adapta Caliro a ti" color="#faf4e6" numColor="#1f1a12" />
      <IntroText text="Caliro funciona mejor cuanto más sabe de ti. Estos son los datos que te conviene tener al día — todos se configuran en la página de Perfil." />

      <div style={{ margin: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Block
          icon="🎯"
          title="Targets calóricos y de macros"
          body="Calorías diarias, proteína, carbos, grasa y peso objetivo. Caliro los calcula en el alta a partir de tu edad, peso, altura y nivel de actividad — pero puedes ajustarlos cuando quieras. Cuanto más realistas, mejor el feedback del Chef y la barra de adherencia."
        />
        <Block
          icon="🥗"
          title="Preferencias dietéticas"
          body="Tipo de dieta (omnívoro, vegetariano, vegano, pescetariano), alergias e intolerancias, y disgustos personales (texto libre). El Chef respeta estas reglas como duras — nunca te va a sugerir nada que tengas marcado como alergia."
        />
        <Block
          icon="💊"
          title="Suplementos diarios"
          body="Configúralos una vez en Perfil (ej. creatina, omega 3, vitamina D) y cada día aparecen automáticamente en el dashboard para que los marques. El Chef sabe qué has tomado y lo incorpora en sus respuestas sobre proteína, recuperación o micronutrientes."
        />
      </div>

      <TipStrip text="El Chef y el motor de calibración se alimentan de tu perfil. Cuanto más completo lo tengas, mejor te entienden y mejor funciona Caliro." />
    </>
  );
}

/* ─── Main Modal ─── */

const PAGES = [Page1, Page2, Page3, Page4, Page5];
const PAGE_TITLES = [
  'Registrar comidas',
  'Motor de calibración',
  'Chef Caliro',
  'Progreso',
  'Tu perfil',
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
        data-theme="light"
        style={{
          background: '#fff',
          colorScheme: 'light',
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
            aria-label="Cerrar ayuda"
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
                aria-label={`Página ${i + 1}`}
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
