import React from 'react';

export default function CartDrawer({
  cartItems,
  cartSubtotal,
  cartDiscountRate,
  cartDiscountAmount,
  cartTotal,
  cartEstimatedPoints,
  distributor,
  willExceedCredit,
  onUpdateCartQty,
  onRemoveFromCart,
  onClearCart,
  onPlaceOrder,
  placingOrder,
}) {
  const loyaltyTier = distributor?.loyaltyTier || 'Bronze';
  const availableCredit = distributor?.availableCredit || 0;

  return (
    <aside className="cart-panel">
      <div className="cart-header">
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          🛒 Current Order ({cartItems.length})
        </h3>
        {cartItems.length > 0 && (
          <button
            onClick={onClearCart}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {cartItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Your cart is empty.<br />Select products from the catalogue to start your order.
        </div>
      ) : (
        <>
          <div className="cart-items-list">
            {cartItems.map((item) => (
              <div key={item.sku} className="cart-item">
                <div className="cart-item-info">
                  <span className="cart-item-name">{item.name}</span>
                  <span className="cart-item-meta">
                    {item.quantity} × ${item.unitPrice.toFixed(2)} = ${item.lineTotal.toFixed(2)}
                  </span>
                </div>
                <div className="cart-item-right">
                  <input
                    type="number"
                    min="1"
                    max={item.available}
                    value={item.quantity}
                    onChange={(e) => onUpdateCartQty(item.sku, e.target.value)}
                    style={{
                      width: '45px',
                      padding: '3px',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      textAlign: 'center',
                      fontWeight: '600',
                    }}
                  />
                  <button
                    className="btn-remove-item"
                    onClick={() => onRemoveFromCart(item.sku)}
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary Breakdown */}
          <div className="cart-summary">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>${cartSubtotal.toFixed(2)}</span>
            </div>

            <div
              className="summary-row"
              style={{
                color: cartDiscountRate > 0 ? 'var(--status-confirmed)' : 'inherit',
                fontWeight: cartDiscountRate > 0 ? '700' : 'normal',
              }}
            >
              <span>
                Tier Discount ({loyaltyTier} - {(cartDiscountRate * 100).toFixed(0)}%):
              </span>
              <span>-${cartDiscountAmount.toFixed(2)}</span>
            </div>

            <div className="summary-row total-row">
              <span>Order Total:</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Loyalty Points Preview (B2, R4) */}
          <div className="points-preview-box">
            <span>Loyalty Points to Earn:</span>
            <strong style={{ fontSize: '1rem' }}>+{cartEstimatedPoints} pts</strong>
          </div>

          {/* Credit Evaluation Notice (R3) */}
          {willExceedCredit ? (
            <div className="credit-warning-box">
              ⚠️ <strong>Credit Check Alert:</strong> Total (${cartTotal.toFixed(2)}) exceeds available credit ($
              {availableCredit.toFixed(2)}).
              <br />
              This order will enter <strong>PENDING APPROVAL</strong> and require Sales Manager review.
            </div>
          ) : (
            <div
              style={{
                fontSize: '0.775rem',
                color: 'var(--status-confirmed)',
                background: 'rgba(16, 185, 129, 0.08)',
                padding: '6px 8px',
                borderRadius: '6px',
                fontWeight: '600',
              }}
            >
              ✅ Within Available Credit (${availableCredit.toFixed(2)}). Will be automatically <strong>CONFIRMED</strong> immediately.
            </div>
          )}

          <button
            id="submit-order-btn"
            className="btn-primary"
            onClick={onPlaceOrder}
            disabled={placingOrder}
            style={{ justifyContent: 'center', padding: '0.75rem', fontSize: '0.95rem' }}
          >
            {placingOrder ? 'Processing Order...' : 'Confirm & Place Order'}
          </button>
        </>
      )}
    </aside>
  );
}
