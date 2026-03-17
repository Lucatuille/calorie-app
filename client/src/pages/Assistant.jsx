import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { buildWelcomeMessage } from '../utils/assistantMessages';

// ── Markdown mínimo ────────────────────────────────────────

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

// ── Typing indicator ───────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '18px 18px 18px 4px', width: 'fit-content', marginBottom: 12 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--text-3)',
          animation: `assistantPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Burbuja de mensaje ─────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      {!isUser && (
        <span style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3, paddingLeft: 4 }}>
          Asistente
        </span>
      )}
      <div style={{
        maxWidth: '85%',
        padding: '11px 15px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser ? 'var(--accent)' : 'var(--surface)',
        color: isUser ? '#fff' : 'var(--text)',
        fontSize: 14,
        lineHeight: 1.65,
        border: isUser ? 'none' : '1px solid var(--border)',
      }}>
        {isUser ? msg.content : <MarkdownText content={msg.content} />}
      </div>
    </div>
  );
}

// ── Chips de sugerencias ───────────────────────────────────

function QuickSuggestions({ onSelect, visible }) {
  const hour = new Date().getHours();
  const suggestions = hour < 12
    ? ['¿Qué desayuno hoy?', '¿Cómo voy esta semana?', '¿Me falta proteína?', 'Dame un resumen']
    : hour < 17
    ? ['¿Qué como esta tarde?', '¿Cómo voy hoy?', '¿Me falta proteína?', 'Analiza mi semana']
    : ['¿Qué ceno hoy?', '¿Cómo he ido esta semana?', '¿Por qué no bajo de peso?', 'Dame un resumen'];

  if (!visible) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 0 12px' }}>
      {suggestions.map(s => (
        <button key={s} onClick={() => onSelect(s)} style={{
          padding: '7px 14px', borderRadius: 100,
          border: '1px solid var(--border)',
          background: 'var(--surface)', fontSize: 13,
          color: 'var(--text-2)', cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}>
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Historial de conversaciones ────────────────────────────

function ConversationHistory({ conversations, onSelect, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 200, display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 640, margin: '0 auto',
        background: 'var(--bg)', borderRadius: '20px 20px 0 0',
        padding: '20px 20px 32px', maxHeight: '70vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <strong style={{ fontSize: 16 }}>Historial</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)' }}>✕</button>
        </div>
        {conversations.length === 0
          ? <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No hay conversaciones anteriores.</p>
          : conversations.map(c => (
            <div key={c.id} onClick={() => onSelect(c)} style={{
              padding: '12px 0', borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
            }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{c.title || `Conversación ${c.id}`}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
                {c.message_count} mensajes · {new Date(c.updated_at).toLocaleDateString('es-ES')}
              </p>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────

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
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Redirigir a usuarios Free
  useEffect(() => {
    if (user && (user.access_level ?? 0) < 2) navigate('/');
  }, [user]);

  // Cargar mensaje de bienvenida con datos reales del día
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
      .catch(() => {
        setMessages([{ role: 'assistant', content: buildWelcomeMessage(user?.name, {}, 0, null), isWelcome: true }]);
      })
      .finally(() => setIntroLoading(false));
  }, []);

  // Scroll al fondo al añadir mensajes
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
      if (err.status === 429) {
        setError(`Límite diario alcanzado (${usage?.limit ?? ''} mensajes). Se renueva mañana.`);
      } else {
        setError('Error al conectar con el asistente. Inténtalo de nuevo.');
      }
      setMessages(prev => prev.slice(0, -1)); // quitar el mensaje del usuario si falla
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

  return (
    <>
      <style>{`
        @keyframes assistantPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 0 80px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, fontWeight: 400, margin: 0 }}>
              Asistente
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>
              Basado en tus datos reales
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {conversationId && (
              <button onClick={startNewConversation} style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 8, padding: '5px 10px', fontSize: 12,
                color: 'var(--text-2)', cursor: 'pointer',
              }}>
                + Nueva
              </button>
            )}
            <button onClick={loadHistory} style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 8, padding: '5px 10px', fontSize: 12,
              color: 'var(--text-2)', cursor: 'pointer',
            }}>
              Historial
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 8px' }}>
          {introLoading && <TypingDots />}

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {loading && <TypingDots />}

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 10, fontSize: 13, color: 'var(--accent-2)', marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Sugerencias + Input */}
        <div style={{ padding: '8px 20px 12px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg)' }}>
          <QuickSuggestions onSelect={handleSend} visible={showSuggestions} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Pregúntame sobre tus datos..."
              rows={1}
              style={{
                flex: 1, resize: 'none', padding: '10px 14px',
                border: '1px solid var(--border)', borderRadius: 12,
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 16, lineHeight: 1.5,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? 'var(--accent)' : 'var(--border)',
                color: '#fff', border: 'none', borderRadius: 10,
                width: 40, height: 40, cursor: input.trim() && !loading ? 'pointer' : 'default',
                fontSize: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              ↑
            </button>
          </div>

          {/* Contador de mensajes */}
          {usage && (
            <p style={{
              fontSize: 11, textAlign: 'center', marginTop: 6,
              color: usage.remaining < 5 ? 'var(--accent-2)' : 'var(--text-3)',
            }}>
              {usage.remaining > 5
                ? `${usage.remaining} mensajes restantes hoy`
                : usage.remaining > 0
                ? `⚠ Solo quedan ${usage.remaining} mensajes hoy`
                : 'Límite diario alcanzado · Se renueva mañana'}
            </p>
          )}

          {/* Disclaimer */}
          <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 2 }}>
            ⓘ El asistente no es un profesional sanitario. Sus respuestas son orientativas.
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
