import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { buildWelcomeMessage } from '../utils/assistantMessages';
import { isPro } from '../utils/levels';
import { openExternal } from '../utils/platform';

// ── ProOnly (dark card) ──────────────────────────────────────

function ProOnlyCard({ onNavigate }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        background: 'linear-gradient(145deg, #1c1c1c, #111111)',
        border: '0.5px solid rgba(255,255,255,0.06)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
            background: 'var(--accent)', color: 'white',
            borderRadius: 4, padding: '2px 6px',
          }}>Pro</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>
            Asistente personal
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 14px', fontFamily: 'var(--font-sans)' }}>
          Chatea con tu nutricionista personal. Conoce tus datos reales — calorías, macros, tendencias — y te orienta con contexto.
        </p>
        <button onClick={onNavigate} style={{
          background: 'var(--accent)', color: '#fff', border: 'none',
          borderRadius: 'var(--radius-md)', padding: '8px 16px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}>
          Ver planes →
        </button>
      </div>
    </div>
  );
}

// ── Markdown mínimo ──────────────────────────────────────────

function inlineFormat(text) {
  // links, bold, italic inline
  const parts = text.split(/(\[.*?\]\(.*?\)|\*\*.*?\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    const linkMatch = p.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      const url = linkMatch[2];
      return (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { e.preventDefault(); openExternal(url); }}
          style={{ color: 'var(--accent)', textDecoration: 'underline' }}
        >{linkMatch[1]}</a>
      );
    }
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*')  && p.endsWith('*'))  return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

function MarkdownText({ content }) {
  const lines = (content || '').split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        // h3
        if (line.startsWith('### ')) {
          return <div key={i} style={{ fontWeight: 700, marginTop: 10, marginBottom: 2 }}>{line.slice(4)}</div>;
        }
        // h2
        if (line.startsWith('## ')) {
          return <div key={i} style={{ fontWeight: 700, fontSize: 15, marginTop: 12, marginBottom: 3 }}>{line.slice(3)}</div>;
        }
        // hr
        if (line === '---') {
          return <hr key={i} style={{ border: 'none', borderTop: '0.5px solid var(--border)', margin: '8px 0' }} />;
        }
        // bullet
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} style={{ paddingLeft: 8, display: 'flex', gap: 4 }}>
              <span style={{ flexShrink: 0 }}>•</span>
              <span>{inlineFormat(line.slice(2))}</span>
            </div>
          );
        }
        // numbered list
        const numMatch = line.match(/^(\d+)\. (.+)/);
        if (numMatch) {
          return (
            <div key={i} style={{ paddingLeft: 4, display: 'flex', gap: 6 }}>
              <span style={{ flexShrink: 0, color: 'var(--text-tertiary)', minWidth: 16 }}>{numMatch[1]}.</span>
              <span>{inlineFormat(numMatch[2])}</span>
            </div>
          );
        }
        // empty line = spacer
        if (line === '') return <div key={i} style={{ height: 6 }} />;
        // plain text
        return <div key={i}>{inlineFormat(line)}</div>;
      })}
    </div>
  );
}

// ── Typing dots ──────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '11px 14px',
      background: 'var(--surface)', border: '0.5px solid var(--border)',
      borderRadius: '16px 16px 16px 3px', width: 'fit-content', marginBottom: 10 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--text-tertiary)',
          animation: `assistantPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Burbuja ──────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 8,
    }}>
      {!isUser && (
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
          background: 'var(--text-primary)', color: 'var(--bg)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          marginBottom: 4, marginLeft: 4,
        }}>
          IA
        </span>
      )}
      <div style={{
        maxWidth: '82%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
        background: isUser ? '#111111' : 'var(--surface)',
        color: isUser ? '#fff' : 'var(--text-primary)',
        fontSize: 14,
        lineHeight: 1.65,
        border: isUser ? 'none' : '0.5px solid var(--border)',
        fontFamily: 'var(--font-sans)',
      }}>
        {isUser ? msg.content : <MarkdownText content={msg.content} />}
      </div>
    </div>
  );
}

// ── Sugerencias rápidas (scroll horizontal) ──────────────────

function QuickSuggestions({ onSelect, visible, todayData }) {
  const hour       = new Date().getHours();
  const cal        = todayData?.cal         || 0;
  const target     = todayData?.target      || 0;
  const remaining  = todayData?.remaining_cal ?? (target - cal);
  const prot       = todayData?.prot        || 0;
  const targetProt = todayData?.target_protein || 0;
  const protGap    = targetProt > 0 ? Math.round(targetProt - prot) : 0;

  let suggestions;
  if (cal === 0) {
    // Sin registros — empezar el día
    const meal = hour < 11 ? 'desayunar' : hour < 15 ? 'comer' : 'cenar';
    suggestions = [`¿Qué puedo ${meal} hoy?`, '¿Cómo empiezo bien el día?', 'Dime mi objetivo de hoy', 'Analiza mi semana'];
  } else if (remaining <= 0) {
    // Objetivo superado
    suggestions = ['¿Cómo ha ido esta semana?', 'Analiza mis macros', '¿Por qué no bajo de peso?', 'Dame un resumen'];
  } else if (remaining < 300) {
    // Poco margen — cena ligera
    suggestions = [`Tengo ${remaining} kcal libres, ¿qué ceno?`, '¿Llego a la proteína?', '¿Cómo ha ido esta semana?', 'Dame un resumen'];
  } else if (protGap > 20) {
    // Déficit de proteína notable
    suggestions = [`Me faltan ${protGap}g de proteína, ¿ideas?`, '¿Cómo voy hoy?', '¿Qué como para cerrar bien?', 'Analiza mi semana'];
  } else {
    // Estado normal — sugerencias por hora
    suggestions = hour < 12
      ? ['¿Qué desayuno hoy?', '¿Cómo voy esta semana?', '¿Me falta proteína?', 'Dame un resumen']
      : hour < 17
      ? ['¿Qué como esta tarde?', '¿Cómo voy hoy?', '¿Me falta proteína?', 'Analiza mi semana']
      : ['¿Qué ceno hoy?', '¿Cómo he ido esta semana?', '¿Por qué no bajo de peso?', 'Dame un resumen'];
  }

  if (!visible) return null;
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      paddingBottom: 10,
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    }}>
      {suggestions.map(s => (
        <button key={s} onClick={() => onSelect(s)} style={{
          whiteSpace: 'nowrap',
          flexShrink: 0,
          padding: '6px 13px',
          borderRadius: 'var(--radius-full)',
          border: '0.5px solid var(--border)',
          background: 'transparent',
          fontSize: 12,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          transition: 'border-color 0.15s, color 0.15s',
        }}>
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Historial bottom sheet ───────────────────────────────────

function ConversationHistory({ conversations, onSelect, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.35)',
      zIndex: 200, display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 640, margin: '0 auto',
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: '20px 20px 0 0',
        padding: '20px 20px 36px',
        maxHeight: '70vh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 99, margin: '0 auto 18px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 20,
            color: 'var(--text-primary)',
            fontWeight: 400,
          }}>Conversaciones</span>
          <button onClick={onClose} style={{
            background: 'var(--surface-2)', border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-full)', width: 28, height: 28,
            cursor: 'pointer', color: 'var(--text-secondary)',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {conversations.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
            No hay conversaciones anteriores.
          </p>
        ) : conversations.map(c => (
          <div key={c.id} onClick={() => onSelect(c)} style={{
            padding: '12px 0',
            borderBottom: '0.5px solid var(--border)',
            cursor: 'pointer',
          }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
              {c.title || `Conversación ${c.id}`}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
              {c.message_count} mensajes · {new Date(c.updated_at).toLocaleDateString('es-ES')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Resumen semanal — bottom sheet (se muestra una vez por semana) ────

function DigestSheet({ digest, onClose }) {
  const dateStr = new Date(digest.generated_at).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 200, display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640, margin: '0 auto',
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 40px',
          maxHeight: '78vh', overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 3, background: 'var(--border)', borderRadius: 99, margin: '0 auto 20px' }} />

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <span style={{
            display: 'block',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--accent)',
            fontFamily: 'var(--font-sans)', marginBottom: 5,
          }}>
            Resumen semanal
          </span>
          <span style={{
            display: 'block',
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            fontSize: 21, color: 'var(--text-primary)', fontWeight: 400,
            marginBottom: 3,
          }}>
            Tu semana en Caliro
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
            {dateStr}
          </span>
        </div>

        {/* Content */}
        <div style={{ fontSize: 14, lineHeight: 1.75, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
          <MarkdownText content={digest.content} />
        </div>

        {/* CTA */}
        <button
          onClick={onClose}
          style={{
            marginTop: 28, width: '100%',
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-md)', padding: '12px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────

export default function Assistant() {
  usePageTitle('Asistente');
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages]             = useState([]);
  const [input, setInput]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [introLoading, setIntroLoading]     = useState(true);
  const [conversationId, setConversationId] = useState(null);
  const [usage, setUsage]                   = useState(null);
  const [showHistory, setShowHistory]       = useState(false);
  const [conversations, setConversations]   = useState([]);
  const [error, setError]                   = useState('');
  const [blocked, setBlocked]               = useState(false);
  const [todayData, setTodayData]           = useState(null);
  const [streak, setStreak]                 = useState(0);
  const [digest, setDigest]                 = useState(null);
  const [digestDismissed, setDigestDismissed] = useState(() => {
    const dismissed = localStorage.getItem('digest_dismissed_week');
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(mon.getDate() + diff);
    const weekStart = mon.toISOString().split('T')[0];
    return dismissed === weekStart;
  });
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (user && !isPro(user.access_level)) navigate('/');
  }, [user]);

  useEffect(() => {
    api.getSummary(token)
      .then(res => setStreak(res.summary?.streak || 0))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!isPro(user?.access_level)) return;
    api.getAssistantDigest(token)
      .then(res => { if (res?.digest) setDigest(res.digest); })
      .catch(() => {}); // silent — never blocks the chat
  }, []);

  useEffect(() => {
    setIntroLoading(true);
    api.getAssistantUsage(token)
      .then(res => {
        if (res?.usage) setUsage(res.usage);
        setTodayData(res?.today || null);
        const t = res?.today;
        const welcome = buildWelcomeMessage(
          user?.name,
          { todayCalories: t?.cal || 0, todayProtein: t?.prot || 0 },
          t?.target         || 0,
          t?.target_protein || null,
        );
        setMessages([{ role: 'assistant', content: welcome, isWelcome: true, timestamp: new Date().toISOString() }]);
      })
      .catch(err => {
        if (err?.status === 403) {
          setBlocked(true);
        } else {
          setMessages([{ role: 'assistant', content: buildWelcomeMessage(user?.name, {}, 0, null), isWelcome: true }]);
        }
      })
      .finally(() => setIntroLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setError('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await api.sendAssistantMessage({ message: msg, conversation_id: conversationId }, token);
      if (res.conversation_id && !conversationId) setConversationId(res.conversation_id);
      if (res.usage) setUsage(res.usage);
      setMessages(prev => [...prev, { role: 'assistant', content: res.message }]);
    } catch (err) {
      if (err.status === 403) {
        setBlocked(true);
        setMessages(prev => prev.slice(0, -1));
      } else if (err.status === 429) {
        setError(`Límite diario alcanzado (${usage?.limit ?? ''} mensajes). Se renueva mañana.`);
        setMessages(prev => prev.slice(0, -1));
      } else if (err.status === 422) {
        setError('La pregunta generó una respuesta demasiado larga. Intenta dividirla en partes más concretas.');
        setMessages(prev => prev.slice(0, -1));
      } else {
        setError('Error al conectar con el asistente. Inténtalo de nuevo.');
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function loadHistory() {
    try {
      const convs = await api.getAssistantConversations(token);
      setConversations(convs || []);
      setShowHistory(true);
    } catch { setConversations([]); setShowHistory(true); }
  }

  async function loadConversation(conv) {
    setShowHistory(false);
    try {
      const msgs = await api.getConversationMessages(conv.id, token);
      setMessages(msgs || []);
      setConversationId(conv.id);
    } catch { /* mantener mensajes actuales */ }
  }

  function startNewConversation() {
    setConversationId(null);
    setError('');
    api.getAssistantUsage(token)
      .then(res => {
        if (res?.usage) setUsage(res.usage);
        const t = res?.today;
        const welcome = buildWelcomeMessage(
          user?.name,
          { todayCalories: t?.cal || 0, todayProtein: t?.prot || 0 },
          t?.target         || 0,
          t?.target_protein || null,
        );
        setMessages([{ role: 'assistant', content: welcome, isWelcome: true, timestamp: new Date().toISOString() }]);
      })
      .catch(() => {
        setMessages([{ role: 'assistant', content: buildWelcomeMessage(user?.name, {}, 0, null), isWelcome: true }]);
      });
  }

  const showSuggestions = messages.length <= 1 && !loading;

  // Usage label — null limit = admin (ilimitado)
  const isUnlimited = usage && (usage.limit === null || usage.limit >= 999);
  const usageLabel = usage
    ? isUnlimited
      ? '∞'
      : usage.remaining > 5
      ? `${usage.remaining} hoy`
      : usage.remaining > 0
      ? `${usage.remaining} restantes`
      : 'Límite alcanzado'
    : null;
  const usageCritical = !isUnlimited && usage && usage.remaining <= 5;

  return (
    <>
      <style>{`
        @keyframes assistantPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .assistant-suggestions::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="assistant-chat" style={{
        maxWidth: 640,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100dvh - 52px)',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <header style={{
          padding: '14px 20px 12px',
          borderBottom: '0.5px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          background: 'var(--bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 22,
              fontWeight: 400,
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1,
            }}>
              Asistente
            </h1>
            {usageLabel && (
              <span style={{
                fontSize: 10,
                color: usageCritical ? 'var(--accent-2)' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.01em',
              }}>
                {usageLabel}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {conversationId && (
              <button onClick={startNewConversation} style={{
                background: 'transparent',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                padding: '5px 12px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>
                + Nueva
              </button>
            )}
            <button onClick={loadHistory} style={{
              background: 'transparent',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              padding: '5px 12px',
              fontSize: 12,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}>
              Historial
            </button>
          </div>
        </header>

        {/* ── Context strip ── */}
        {todayData && (
          <div className="context-strip">
            <div className="ctx-pill">
              <span className={`ctx-pill__num${(todayData.target || 0) > (todayData.cal || 0) ? ' ctx-pill__num--green' : ''}`}>
                {Math.max(0, (todayData.target || 0) - (todayData.cal || 0)).toLocaleString('es')}
              </span>
              <span className="ctx-pill__label">kcal libres</span>
            </div>
            <div className="ctx-pill">
              <span className="ctx-pill__num">
                {Math.max(0, Math.round((todayData.target_protein || 0) - (todayData.prot || 0)))}g
              </span>
              <span className="ctx-pill__label">proteína</span>
            </div>
            <div className="ctx-pill">
              <span className="ctx-pill__num">🔥{streak}</span>
              <span className="ctx-pill__label">días racha</span>
            </div>
          </div>
        )}

        {/* ── Mensajes ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 8px' }}>
          {introLoading && <TypingDots />}

          {blocked
            ? <ProOnlyCard onNavigate={() => navigate('/planes')} />
            : messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
          }

          {loading && <TypingDots />}

          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--surface)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--accent-2)',
              marginBottom: 10,
              fontFamily: 'var(--font-sans)',
            }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input area ── */}
        <div style={{
          paddingTop: 10,
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
          borderTop: '0.5px solid var(--border)',
          flexShrink: 0,
          background: 'var(--bg)',
        }}>
          <QuickSuggestions onSelect={handleSend} visible={showSuggestions} todayData={todayData} />

          {/* Input row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 6 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Pregúntame sobre tus datos…"
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                padding: '10px 14px',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: 15,
                lineHeight: 1.5,
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: input.trim() && !loading ? 'var(--accent)' : 'var(--surface-2)',
                border: `0.5px solid ${input.trim() && !loading ? 'var(--accent)' : 'var(--border)'}`,
                color: input.trim() && !loading ? '#fff' : 'var(--text-tertiary)',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                fontSize: 16,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              }}
            >
              ↑
            </button>
          </div>

          {/* Disclaimer */}
          <p style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            marginTop: 8,
            fontFamily: 'var(--font-sans)',
            opacity: 0.7,
          }}>
            No es un profesional sanitario · Respuestas orientativas
          </p>
        </div>
      </div>

      {showHistory && (
        <ConversationHistory
          conversations={conversations}
          onSelect={loadConversation}
          onClose={() => setShowHistory(false)}
        />
      )}

      {digest && !digestDismissed && (
        <DigestSheet digest={digest} onClose={() => {
          setDigestDismissed(true);
          const now = new Date();
          const day = now.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          const mon = new Date(now);
          mon.setDate(mon.getDate() + diff);
          localStorage.setItem('digest_dismissed_week', mon.toISOString().split('T')[0]);
        }} />
      )}
    </>
  );
}
