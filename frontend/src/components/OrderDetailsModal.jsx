import React from 'react';

export default function OrderDetailsModal({ order, onClose }) {
  if (!order) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Order Breakdown: {order.id}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
              background: 'var(--bg-secondary)',
              padding: '1rem',
              borderRadius: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</div>
              <span className={`status-pill ${order.status}`}>
                {order.status.toUpperCase()}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Distributor</div>
              <div style={{ fontWeight: '700' }}>{order.distributorName}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Discount Rate</div>
              <div style={{ color: 'var(--status-confirmed)', fontWeight: '700' }}>
                {(order.discountRate * 100).toFixed(0)}% (-${order.discountAmount?.toFixed(2)})
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Points Awarded</div>
              <div style={{ color: 'var(--status-pending)', fontWeight: '700' }}>
                +{order.pointsAwarded} pts
              </div>
            </div>
          </div>

          <h4 style={{ fontSize: '0.95rem', fontWeight: '800', marginTop: '0.5rem' }}>Line Items:</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {order.items?.map((it, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-secondary)',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <span className="product-sku" style={{ marginRight: '8px' }}>{it.sku}</span>
                  <strong>{it.name}</strong>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)' }}>
                  {it.quantity} × ${it.unitPrice?.toFixed(2)} = <strong>${it.lineTotal?.toFixed(2)}</strong>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '0.75rem',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '2rem',
              fontSize: '1.1rem',
            }}
          >
            <span>Subtotal: ${order.subtotal?.toFixed(2)}</span>
            <strong>Total: ${order.total?.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
