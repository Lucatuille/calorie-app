import { Component } from 'react';
import * as Sentry from '@sentry/react';

export default class RouteErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '60px 24px', textAlign: 'center',
          maxWidth: 400, margin: '0 auto',
        }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            fontSize: 24, color: 'var(--accent)', marginBottom: 12,
          }}>
            Oops
          </div>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 14,
            color: 'var(--text-primary)', marginBottom: 6,
          }}>
            Algo salió mal en esta página.
          </p>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 12,
            color: 'var(--text-secondary)', marginBottom: 20,
          }}>
            El error ha sido reportado. Puedes volver o reintentar.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                padding: '8px 20px', background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
            <button
              onClick={() => window.history.back()}
              style={{
                padding: '8px 20px', background: 'none',
                border: '0.5px solid var(--border)', color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-sans)', fontSize: 13, cursor: 'pointer',
              }}
            >
              Volver
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
