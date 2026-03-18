import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { buildWelcomeMessage } from '../utils/assistantMessages';
import { isPro } from '../utils/levels';

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

function MarkdownText({ content }) {
  const lines = (content || '').split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        if (line.startsWith('- ') || line.startsWith('• ')) {
          const text = line.slice(2);
          const parts = text.split(/\*\*(.*?)\*\*/g);
          return (
            <div key={i} style={{ paddingLeft: 8 }}>
              {'• '}{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
            </div>
          );
        }
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <div key={i} style={{ minHeight: line === '' ? 8 : undefined }}>
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
          </div>
        );
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
      <div style={{
        maxWidth: '82%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
        background: isUser ? 'var(--accent)' : 'var(--surface)',
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

function QuickSuggestions({ onSelect, visible }) {
  const hour = new Date().getHours();
  const suggestions = hour < 12
    ? ['¿Qué desayuno hoy?', '¿Cómo voy esta semana?', '¿Me falta proteína?', 'Dame un resumen']
    : hour < 17
    ? ['¿Qué como esta tarde?', '¿Cómo voy hoy?', '¿Me falta proteína?', 'Analiza mi semana']
    : ['¿Qué ceno hoy?', '¿Cómo he ido esta semana?', '¿Por qué no bajo de peso?', 'Dame un resumen'];

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

// ── Página principal ─────────────────────────────────────────

export default function Assistant() {
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
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (user && !isPro(user.access_level)) navigate('/');
  }, [user]);

  useEffect(() => {
    setIntroLoading(true);
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
        height: 'calc(100vh - 52px)',
      }}>

        {/* ── Header ── */}
        <div style={{
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
        </div>

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
          padding: '10px 16px 16px',
          borderTop: '0.5px solid var(--border)',
          flexShrink: 0,
          background: 'var(--bg)',
        }}>
          <QuickSuggestions onSelect={handleSend} visible={showSuggestions} />

          {/* Input row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
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
    </>
  );
}
