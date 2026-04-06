// ============================================================
//  Skeleton loaders — reemplaza spinners genéricos con
//  formas que anticipan el contenido real
// ============================================================

const shimmerBg = 'linear-gradient(90deg, var(--border) 25%, var(--surface) 50%, var(--border) 75%)';

function Bone({ w = '100%', h = 14, r = 6, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: shimmerBg,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

// ── Dashboard skeleton ────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <section style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 40, opacity: 0.7 }}>
      {/* Header */}
      <header style={{ padding: '20px 20px 0' }}>
        <Bone w={80} h={11} style={{ marginBottom: 8 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Bone w={140} h={24} r={4} />
          <Bone w={70} h={22} r={999} />
        </div>
      </header>

      {/* Hero card */}
      <div style={{ padding: '0 16px', marginBottom: 10 }}>
        <div style={{
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '24px 20px',
        }}>
          {/* Hero number */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Bone w={120} h={48} r={8} style={{ margin: '0 auto 8px' }} />
            <Bone w={100} h={12} style={{ margin: '0 auto' }} />
          </div>
          {/* Progress bar segments */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
            {[...Array(10)].map((_, i) => (
              <Bone key={i} h={6} r={3} style={{ flex: 1 }} />
            ))}
          </div>
          <Bone w={180} h={11} style={{ margin: '0 auto' }} />
          {/* Macros */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                background: 'var(--bg)', borderRadius: 10, padding: '12px 10px',
                border: '0.5px solid var(--border)',
              }}>
                <Bone w={40} h={10} style={{ marginBottom: 6 }} />
                <Bone w={60} h={18} r={4} style={{ marginBottom: 6 }} />
                <Bone h={4} r={2} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Meals card */}
      <div style={{ padding: '0 16px', marginBottom: 10 }}>
        <div style={{
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '16px',
        }}>
          <Bone w={120} h={13} style={{ marginBottom: 14 }} />
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0',
              borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
            }}>
              <div>
                <Bone w={100 + i * 20} h={13} style={{ marginBottom: 4 }} />
                <Bone w={60} h={10} />
              </div>
              <Bone w={50} h={16} r={4} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── History skeleton ──────────────────────────────────────

export function HistorySkeleton() {
  return (
    <section style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 40, opacity: 0.7 }}>
      <header style={{ padding: '20px 20px 20px' }}>
        <Bone w={100} h={24} r={4} />
      </header>

      <div style={{ padding: '0 16px' }}>
        {[0, 1, 2].map(day => (
          <div key={day} style={{ marginBottom: 20 }}>
            {/* Day header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 8,
            }}>
              <div>
                <Bone w={90} h={13} style={{ marginBottom: 4 }} />
                <Bone w={120} h={11} />
              </div>
              <Bone w={60} h={14} r={4} />
            </div>
            {/* Entries card */}
            <div style={{
              background: 'var(--surface)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            }}>
              {[0, 1].map(entry => (
                <div key={entry} style={{
                  padding: '12px 14px',
                  borderTop: entry > 0 ? '0.5px solid var(--border)' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Bone w={14} h={14} r={4} />
                      <Bone w={80 + entry * 30} h={13} />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <Bone w={30} h={10} />
                      <Bone w={30} h={10} />
                      <Bone w={30} h={10} />
                    </div>
                  </div>
                  <Bone w={50} h={16} r={4} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Progress skeleton ─────────────────────────────────────

export function ProgressSkeleton() {
  return (
    <section style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 40, opacity: 0.7 }}>
      {/* Header + period pills */}
      <header style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Bone w={100} h={24} r={4} />
          <div style={{ display: 'flex', gap: 6 }}>
            <Bone w={36} h={28} r={999} />
            <Bone w={36} h={28} r={999} />
            <Bone w={36} h={28} r={999} />
          </div>
        </div>
      </header>

      <div style={{ padding: '0 16px' }}>
        {/* Stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {/* Dark card (average) */}
          <div style={{
            background: 'var(--text-primary)', borderRadius: 'var(--radius-lg)',
            padding: '16px',
          }}>
            <Bone w={50} h={10} style={{ opacity: 0.3, marginBottom: 8 }} />
            <Bone w={80} h={32} r={4} style={{ opacity: 0.2 }} />
          </div>
          {/* Light cards */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              background: 'var(--surface)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '16px',
            }}>
              <Bone w={60} h={10} style={{ marginBottom: 8 }} />
              <Bone w={50} h={24} r={4} />
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div style={{
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: 16,
        }}>
          <Bone w={120} h={13} style={{ marginBottom: 16 }} />
          <Bone h={160} r={8} />
        </div>

        {/* Macros bar */}
        <div style={{
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: 16,
        }}>
          <Bone w={140} h={13} style={{ marginBottom: 12 }} />
          <Bone h={12} r={6} style={{ marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 20 }}>
            <Bone w={60} h={10} />
            <Bone w={60} h={10} />
            <Bone w={60} h={10} />
          </div>
        </div>
      </div>
    </section>
  );
}
