import React from 'react';

export default function FlowchartModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📊 State Machine & Invariants Architecture</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.75rem', fontWeight: '800' }}>
              Order Status Transitions (State Diagram v2)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span className="status-pill placed">PLACED</span>
                <span>→</span>
                <span className="status-pill confirmed">CONFIRMED</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  (If Order Total ≤ Available Credit. Stock reserved, points auto-awarded)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span className="status-pill placed">PLACED</span>
                <span>→</span>
                <span className="status-pill pendingApproval">PENDING APPROVAL</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  (If Order Total &gt; Available Credit. Stock reserved, awaiting manager review)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span className="status-pill pendingApproval">PENDING APPROVAL</span>
                <span>→</span>
                <span className="status-pill confirmed">CONFIRMED</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  (Sales Manager Approves. Points awarded, trailing 90-day tier recalculated)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span className="status-pill pendingApproval">PENDING APPROVAL</span>
                <span>→</span>
                <span className="status-pill rejected">REJECTED</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  (Sales Manager Rejects. Reserved stock released)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span className="status-pill confirmed">CONFIRMED</span>
                <span>→</span>
                <span className="status-pill dispatched">DISPATCHED</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  (Stock permanently deducted from warehouse inventory)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span className="status-pill dispatched">DISPATCHED</span>
                <span>→</span>
                <span className="status-pill delivered">DELIVERED</span>
                <span style={{ color: 'var(--text-muted)' }}>(Final customer fulfillment)</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span className="status-pill confirmed">CONFIRMED</span>
                <span>→</span>
                <span className="status-pill cancelled">CANCELLED</span>
                <span style={{ color: 'var(--status-rejected)' }}>
                  (R1: Releases stock. R5: Reverses awarded points in ledger & recalculates tier!)
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ color: 'var(--status-pending)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '800' }}>
                Loyalty Tiers (B2, R2, R4, R5)
              </h4>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li><strong>Bronze</strong>: 0 - 999 pts in trailing 90 days → 0% discount</li>
                <li><strong>Silver</strong>: 1000 - 4999 pts in trailing 90 days → 3% discount</li>
                <li><strong>Gold</strong>: 5000+ pts in trailing 90 days → 6% discount</li>
                <li>Points = <code>floor(Total / 100)</code> awarded on entering confirmed</li>
                <li>Tier discount locked at placement; future tier shifts do not alter placed orders</li>
              </ul>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ color: 'var(--status-confirmed)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '800' }}>
                Stock & Credit Rules (R1, R3)
              </h4>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li><strong>R1</strong>: Available Stock = Stock Quantity - Reserved Quantity.</li>
                <li>Order rejected if any item has insufficient available stock.</li>
                <li>Stock permanently deducted only on <code>dispatched</code>.</li>
                <li><strong>R3</strong>: Available Credit = Credit Limit - Active Orders total.</li>
                <li>Active orders = all orders NOT in delivered, cancelled, or rejected.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
