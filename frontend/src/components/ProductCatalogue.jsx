import React from 'react';

export default function ProductCatalogue({ products, onAddToCart }) {
  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">📦 Available Products & Warehouse Stock</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Single Warehouse Inventory • Real-time Reservations from Database
        </span>
      </div>

      <div className="product-grid">
        {products.map((p) => {
          const isOOS = p.availableQuantity <= 0;
          const isLow = p.availableQuantity === 1;

          return (
            <div key={p.sku} className="product-card" id={`product-${p.sku}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="product-sku">{p.sku}</span>
                {isOOS ? (
                  <span className="stock-tag out-of-stock">Out of Stock (0)</span>
                ) : isLow ? (
                  <span className="stock-tag low-stock">Only 1 Left!</span>
                ) : (
                  <span className="stock-tag in-stock">In Stock</span>
                )}
              </div>

              <h3 className="product-name">{p.name}</h3>

              <div className="product-price">${p.unitPrice?.toFixed(2)}</div>

              {/* Live Warehouse Stock Breakdown */}
              <div className="stock-indicator">
                <span>On-Hand: <strong>{p.stockQuantity}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Reserved: {p.reservedQuantity}</span>
                <span style={{ color: isOOS ? 'var(--status-rejected)' : 'var(--status-confirmed)', fontWeight: '700' }}>
                  Avail: {p.availableQuantity}
                </span>
              </div>

              {/* Add to Cart Action */}
              <form
                className="product-action-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.target.elements[`qty-${p.sku}`];
                  onAddToCart(p.sku, input.value);
                }}
              >
                <input
                  id={`input-qty-${p.sku}`}
                  name={`qty-${p.sku}`}
                  type="number"
                  min="1"
                  max={p.availableQuantity}
                  defaultValue="1"
                  disabled={isOOS}
                  className="qty-input"
                />
                <button
                  id={`btn-add-${p.sku}`}
                  type="submit"
                  disabled={isOOS}
                  className="btn-add-cart"
                >
                  {isOOS ? 'Unavailable' : 'Add to Cart'}
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
