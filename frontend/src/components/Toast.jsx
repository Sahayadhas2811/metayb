import React from 'react';

export default function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div className="toast-container">
      <div className={`toast ${toast.type}`}>
        <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
