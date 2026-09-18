import React from 'react';

export default function LoadingSpinner({ message = 'Loading live data from PostgreSQL database...' }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
      <div
        style={{
          display: 'inline-block',
          width: '36px',
          height: '36px',
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--accent-blue)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '1rem',
        }}
      />
      <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>{message}</div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
