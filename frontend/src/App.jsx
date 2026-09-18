import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = '/api';

export default function App() {
  // Theme State: 'light' is default
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('metayb_theme') || 'light';
  });

  // Navigation & Actor State
  const [activeRole, setActiveRole] = useState('distributor'); // 'distributor' | 'manager'
  const [activeTab, setActiveTab] = useState('catalogue'); // 'catalogue' | 'orders' | 'flowchart'
  const [selectedDistributorId, setSelectedDistributorId] = useState('D-101');

  // Server Data
  const [products, setProducts] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cart State (map: sku -> quantity)
  const [cart, setCart] = useState({});
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [showFlowchartModal, setShowFlowchartModal] = useState(false);

  // Notification Toast
  const [toast, setToast] = useState(null);

  // Sync theme with DOM and localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('metayb_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev?.id ? null : prev));
    }, 4500);
  };

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, distRes, ordRes] = await Promise.all([
        fetch(`${API_BASE}/products`),
        fetch(`${API_BASE}/distributors`),
        fetch(`${API_BASE}/orders`),
      ]);

      if (!prodRes.ok || !distRes.ok || !ordRes.ok) {
        throw new Error('Failed to load server data.');
      }

      const prodData = await prodRes.json();
      const distData = await distRes.json();
      const ordData = await ordRes.json();

      setProducts(prodData);
      setDistributors(distData);
      setOrders(ordData);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Current active distributor
  const currentDistributor = useMemo(() => {
    return (
      distributors.find((d) => d.id === selectedDistributorId) ||
      distributors[0] || {
        id: 'D-101',
        name: 'Distributor',
        creditLimit: 5000,
        availableCredit: 5000,
        loyaltyTier: 'Bronze',
        trailingPoints: 0,
        discountRate: 0.0,
      }
    );
  }, [distributors, selectedDistributorId]);

  // Cart Calculations
  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([sku, qty]) => {
        const prod = products.find((p) => p.sku === sku);
        if (!prod || qty <= 0) return null;
        return {
          sku,
          name: prod.name,
          unitPrice: prod.unitPrice,
          quantity: qty,
          available: prod.availableQuantity,
          lineTotal: prod.unitPrice * qty,
        };
      })
      .filter(Boolean);
  }, [cart, products]);

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, i) => acc + i.lineTotal, 0);
  }, [cartItems]);

  const cartDiscountRate = currentDistributor.discountRate || 0;
  const cartDiscountAmount = Math.round(cartSubtotal * cartDiscountRate * 100) / 100;
  const cartTotal = Math.round((cartSubtotal - cartDiscountAmount) * 100) / 100;
  const cartEstimatedPoints = Math.floor(cartTotal / 100);
  const willExceedCredit = cartTotal > (currentDistributor.availableCredit || 0);

  // Cart Operations
  const handleAddToCart = (sku, quantity) => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) return;

    const prod = products.find((p) => p.sku === sku);
    if (!prod) return;

    const currentQtyInCart = cart[sku] || 0;
    if (currentQtyInCart + qty > prod.availableQuantity) {
      showToast(
        `Cannot add ${qty} units. Only ${prod.availableQuantity - currentQtyInCart} units remaining in stock.`,
        'error'
      );
      return;
    }

    setCart((prev) => ({
      ...prev,
      [sku]: (prev[sku] || 0) + qty,
    }));

    showToast(`Added ${qty}x ${prod.name} to cart.`);
  };

  const handleUpdateCartQty = (sku, newQty) => {
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) {
      handleRemoveFromCart(sku);
      return;
    }
    const prod = products.find((p) => p.sku === sku);
    if (prod && qty > prod.availableQuantity) {
      showToast(`Requested quantity exceeds available stock (${prod.availableQuantity}).`, 'error');
      return;
    }
    setCart((prev) => ({ ...prev, [sku]: qty }));
  };

  const handleRemoveFromCart = (sku) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[sku];
      return next;
    });
  };

  const handleClearCart = () => setCart({});

  // Place Order
  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      showToast('Your cart is empty.', 'error');
      return;
    }

    try {
      const payload = {
        distributorId: currentDistributor.id,
        items: cartItems.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
      };

      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order.');
      }

      showToast(
        data.status === 'confirmed'
          ? `Order ${data.orderId} placed & CONFIRMED! (+${data.pointsAwarded} points)`
          : `Order ${data.orderId} placed. Status: PENDING APPROVAL (Total exceeds available credit).`,
        data.status === 'confirmed' ? 'success' : 'error'
      );

      handleClearCart();
      await fetchData();
      setActiveTab('orders');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Transition Order Status (Approve, Reject, Dispatch, Deliver, Cancel)
  const handleOrderStatusTransition = async (orderId, targetStatus) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus,
          actorRole: activeRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to transition order to ${targetStatus}`);
      }

      showToast(`Order ${orderId} moved to "${targetStatus.toUpperCase()}".`);
      await fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Reset database seed data
  const handleResetSeed = async () => {
    if (!window.confirm('Reset database to clean seed state (8 products, 3 distributors, historical orders)?')) return;
    try {
      const res = await fetch(`${API_BASE}/reset-seed`, { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      showToast('Database reset to clean seed state.');
      handleClearCart();
      await fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="app-container" data-theme={theme}>
      {/* Top Navbar */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">M</div>
          <div>
            <div className="brand-title">MetaYB Supply</div>
            <div className="brand-subtitle">Consumer Goods B2B Portal & Loyalty Engine</div>
          </div>
        </div>

        {/* Role & Actor Switcher */}
        <div className="role-switcher-container">
          <button
            id="role-distributor-btn"
            className={`role-tab-btn ${activeRole === 'distributor' ? 'active' : ''}`}
            onClick={() => {
              setActiveRole('distributor');
              setActiveTab('catalogue');
            }}
          >
            🏢 Distributor Portal
          </button>
          <button
            id="role-manager-btn"
            className={`role-tab-btn ${activeRole === 'manager' ? 'active' : ''}`}
            onClick={() => {
              setActiveRole('manager');
              setActiveTab('manager-queue');
            }}
          >
            👔 Sales Manager Portal
          </button>
        </div>

        {/* Header Right Actions */}
        <div className="header-actions">
          {activeRole === 'distributor' && (
            <div className="distributor-select-badge">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ACTOR:</span>
              <select
                id="select-distributor"
                value={selectedDistributorId}
                onChange={(e) => setSelectedDistributorId(e.target.value)}
              >
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.loyaltyTier})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-btn"
            className="btn-secondary"
            onClick={toggleTheme}
            title="Toggle between White Theme and Dark Theme"
          >
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ White Theme'}
          </button>

          <button
            id="open-flowchart-btn"
            className="btn-secondary"
            onClick={() => setShowFlowchartModal(true)}
            title="View State Machine & Architecture Flowchart"
          >
            📊 Flowchart
          </button>

          <button
            id="reset-seed-btn"
            className="btn-secondary"
            onClick={handleResetSeed}
            title="Reset Database to initial B5 seed"
          >
            🔄 Reset Seed
          </button>
        </div>
      </header>

      {/* Distributor Navigation Bar */}
      {activeRole === 'distributor' && (
        <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', padding: '0.5rem 1.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
            <button
              id="tab-catalogue-btn"
              className={`role-tab-btn ${activeTab === 'catalogue' ? 'active' : ''}`}
              onClick={() => setActiveTab('catalogue')}
            >
              📦 Product Catalogue ({products.length})
            </button>
            <button
              id="tab-orders-btn"
              className={`role-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              📜 Order History ({orders.filter((o) => o.distributorId === currentDistributor.id).length})
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="main-content">
        {/* DISTRIBUTOR OVERVIEW METRICS */}
        {activeRole === 'distributor' && (
          <section className="distributor-overview-grid">
            {/* Credit Limit Card */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Credit Limit (Currency)</span>
                <span style={{ fontSize: '1.2rem' }}>💳</span>
              </div>
              <div className="metric-value">${currentDistributor.creditLimit?.toLocaleString()}</div>
              <div className="metric-subtext">Total credit line assigned to your account</div>
            </div>

            {/* Available Credit Card (R3) */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Available Credit (R3)</span>
                <span style={{ fontSize: '1.2rem' }}>🛡️</span>
              </div>
              <div
                className="metric-value"
                style={{
                  color: (currentDistributor.availableCredit || 0) > 1000 ? 'var(--status-confirmed)' : 'var(--status-pending)',
                }}
              >
                ${Math.max(0, currentDistributor.availableCredit || 0).toLocaleString()}
              </div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        (((currentDistributor.creditLimit || 1) - (currentDistributor.availableCredit || 0)) /
                          (currentDistributor.creditLimit || 1)) *
                          100
                      )
                    )}%`,
                    background:
                      (currentDistributor.availableCredit || 0) < 1000 ? 'var(--status-pending)' : 'var(--accent-blue)',
                  }}
                />
              </div>
              <div className="metric-subtext" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                <span>Exposure: ${(currentDistributor.exposure || 0).toLocaleString()}</span>
                <span>Active Orders</span>
              </div>
            </div>

            {/* Loyalty Tier & Discount (B2, R2) */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Current Loyalty Tier</span>
                <span className={`tier-badge ${currentDistributor.loyaltyTier?.toLowerCase()}`}>
                  {currentDistributor.loyaltyTier}
                </span>
              </div>
              <div className="metric-value">
                {currentDistributor.discountRate ? `${(currentDistributor.discountRate * 100).toFixed(0)}% OFF` : '0% (Standard)'}
              </div>
              <div className="metric-subtext">
                Applied automatically to subtotal of new orders (Fixed per R2)
              </div>
            </div>

            {/* Trailing 90-Day Points (B2, R4, R5) */}
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Trailing 90-Day Points</span>
                <span style={{ fontSize: '1.2rem' }}>⭐</span>
              </div>
              <div className="metric-value" style={{ color: 'var(--status-pending)' }}>
                {currentDistributor.trailingPoints?.toLocaleString()} pts
              </div>
              <div className="metric-subtext">
                {currentDistributor.loyaltyTier === 'Gold'
                  ? 'Top Tier (5000+ points) - 6% discount unlocked'
                  : currentDistributor.loyaltyTier === 'Silver'
                  ? `${5000 - currentDistributor.trailingPoints} pts until Gold tier (6%)`
                  : `${1000 - currentDistributor.trailingPoints} pts until Silver tier (3%)`}
              </div>
            </div>
          </section>
        )}

        {/* DISTRIBUTOR PORTAL - CATALOGUE & CART TAB */}
        {activeRole === 'distributor' && activeTab === 'catalogue' && (
          <div className="ordering-layout">
            {/* Products Grid */}
            <div>
              <div className="section-header">
                <h2 className="section-title">📦 Available Products & Warehouse Stock</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Single Warehouse Inventory • Real-time Reservations
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

                      {/* Stock Breakdown */}
                      <div className="stock-indicator">
                        <span>On-Hand: <strong>{p.stockQuantity}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>Reserved: {p.reservedQuantity}</span>
                        <span style={{ color: isOOS ? 'var(--status-rejected)' : 'var(--status-confirmed)', fontWeight: '700' }}>
                          Avail: {p.availableQuantity}
                        </span>
                      </div>

                      {/* Add to Cart Actions */}
                      <form
                        className="product-action-row"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const input = e.target.elements[`qty-${p.sku}`];
                          handleAddToCart(p.sku, input.value);
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

            {/* Cart Drawer */}
            <aside className="cart-panel">
              <div className="cart-header">
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  🛒 Current Order ({cartItems.length})
                </h3>
                {cartItems.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
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
                            onChange={(e) => handleUpdateCartQty(item.sku, e.target.value)}
                            style={{ width: '45px', padding: '3px', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '4px', textAlign: 'center', fontWeight: '600' }}
                          />
                          <button
                            className="btn-remove-item"
                            onClick={() => handleRemoveFromCart(item.sku)}
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

                    <div className="summary-row" style={{ color: cartDiscountRate > 0 ? 'var(--status-confirmed)' : 'inherit', fontWeight: cartDiscountRate > 0 ? '700' : 'normal' }}>
                      <span>
                        Tier Discount ({currentDistributor.loyaltyTier} - {(cartDiscountRate * 100).toFixed(0)}%):
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
                      {currentDistributor.availableCredit?.toFixed(2)}).
                      <br />
                      This order will enter <strong>PENDING APPROVAL</strong> and require Sales Manager review.
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.775rem', color: 'var(--status-confirmed)', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 8px', borderRadius: '6px', fontWeight: '600' }}>
                      ✅ Within Available Credit (${currentDistributor.availableCredit?.toFixed(2)}). Will be automatically <strong>CONFIRMED</strong> immediately.
                    </div>
                  )}

                  <button
                    id="submit-order-btn"
                    className="btn-primary"
                    onClick={handlePlaceOrder}
                    style={{ justifyContent: 'center', padding: '0.75rem', fontSize: '0.95rem' }}
                  >
                    Confirm & Place Order
                  </button>
                </>
              )}
            </aside>
          </div>
        )}

        {/* DISTRIBUTOR ORDER HISTORY TAB */}
        {activeRole === 'distributor' && activeTab === 'orders' && (
          <div>
            <div className="section-header">
              <h2 className="section-title">📜 Your Order History ({currentDistributor.name})</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Track order transitions, reserved stock, and awarded loyalty points
              </span>
            </div>

            <div className="orders-table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Line Items</th>
                    <th>Subtotal</th>
                    <th>Discount</th>
                    <th>Total</th>
                    <th>Points</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter((o) => o.distributorId === currentDistributor.id)
                    .map((o) => (
                      <tr key={o.id}>
                        <td className="order-id-cell">{o.id}</td>
                        <td style={{ fontSize: '0.775rem' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                        <td>
                          <span className={`status-pill ${o.status}`}>{o.status.toUpperCase()}</span>
                        </td>
                        <td>
                          <button
                            className="btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            onClick={() => setSelectedOrderDetails(o)}
                          >
                            View {o.items?.length || 0} Items
                          </button>
                        </td>
                        <td>${o.subtotal?.toFixed(2)}</td>
                        <td>
                          {o.discountRate > 0 ? (
                            <span style={{ color: 'var(--status-confirmed)', fontWeight: '700' }}>
                              {(o.discountRate * 100).toFixed(0)}% (-${o.discountAmount?.toFixed(2)})
                            </span>
                          ) : (
                            '0%'
                          )}
                        </td>
                        <td style={{ fontWeight: '800', color: 'var(--text-primary)' }}>${o.total?.toFixed(2)}</td>
                        <td style={{ color: 'var(--status-pending)', fontWeight: '700' }}>
                          {o.pointsAwarded > 0 ? `+${o.pointsAwarded}` : '0'}
                        </td>
                        <td>
                          {['placed', 'pendingApproval', 'confirmed'].includes(o.status) && (
                            <button
                              id={`cancel-order-${o.id}`}
                              className="btn-danger"
                              onClick={() => {
                                if (window.confirm(`Cancel order ${o.id}? This will release reserved stock${o.status === 'confirmed' ? ' and reverse awarded points' : ''}.`)) {
                                  handleOrderStatusTransition(o.id, 'cancelled');
                                }
                              }}
                            >
                              Cancel Order
                            </button>
                          )}
                          {o.status === 'dispatched' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In Transit</span>
                          )}
                          {['delivered', 'cancelled', 'rejected'].includes(o.status) && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Archived</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  {orders.filter((o) => o.distributorId === currentDistributor.id).length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No orders found for this distributor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SALES MANAGER PORTAL */}
        {activeRole === 'manager' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Manager Header */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary)' }}>👔 Sales Manager Control Board</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Logged in as <strong>Ava Sterling</strong> (ava.manager@metayb.com) • Authority to Override Credit Approvals & Dispatch Warehouse Stock
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '0.5rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--status-pending)', textTransform: 'uppercase', fontWeight: '700' }}>Pending Approval</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {orders.filter((o) => o.status === 'pendingApproval').length}
                  </div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '0.5rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--status-confirmed)', textTransform: 'uppercase', fontWeight: '700' }}>Ready for Dispatch</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {orders.filter((o) => o.status === 'confirmed').length}
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Approvals Queue (R3, B3) */}
            <div>
              <div className="section-header">
                <h3 className="section-title">
                  ⚠️ Orders Pending Manager Approval (Credit Exceeded)
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Orders whose total exceeded the distributor's available credit limit
                </span>
              </div>

              <div className="orders-table-wrapper">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Distributor</th>
                      <th>Order Total</th>
                      <th>Distributor Credit Limit</th>
                      <th>Available Credit</th>
                      <th>Items</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders
                      .filter((o) => o.status === 'pendingApproval')
                      .map((o) => {
                        const dist = distributors.find((d) => d.id === o.distributorId);
                        return (
                          <tr key={o.id}>
                            <td className="order-id-cell">{o.id}</td>
                            <td>
                              <strong>{o.distributorName}</strong> ({o.distributorId})
                            </td>
                            <td style={{ fontWeight: '800', color: 'var(--status-pending)', fontSize: '0.95rem' }}>
                              ${o.total?.toFixed(2)}
                            </td>
                            <td>${dist?.creditLimit?.toLocaleString()}</td>
                            <td style={{ color: (dist?.availableCredit || 0) < 0 ? 'var(--status-rejected)' : 'inherit', fontWeight: '600' }}>
                              ${dist?.availableCredit?.toFixed(2)}
                            </td>
                            <td>
                              <button
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                onClick={() => setSelectedOrderDetails(o)}
                              >
                                View {o.items?.length || 0} Items
                              </button>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  id={`btn-approve-${o.id}`}
                                  className="btn-success"
                                  onClick={() => handleOrderStatusTransition(o.id, 'confirmed')}
                                  title="Approve Order and Award Loyalty Points"
                                >
                                  ✓ Approve (Confirm)
                                </button>
                                <button
                                  id={`btn-reject-${o.id}`}
                                  className="btn-danger"
                                  onClick={() => handleOrderStatusTransition(o.id, 'rejected')}
                                  title="Reject Order and Release Reserved Stock"
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {orders.filter((o) => o.status === 'pendingApproval').length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No orders waiting for approval.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Warehouse Fulfillment / Dispatch Board (R1, B3) */}
            <div>
              <div className="section-header">
                <h3 className="section-title">
                  🚚 Warehouse Fulfillment & Dispatch Board
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Dispatching permanently deducts reserved stock from warehouse inventory (R1)
                </span>
              </div>

              <div className="orders-table-wrapper">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Distributor</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Points Awarded</th>
                      <th>Line Items</th>
                      <th>Fulfillment Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders
                      .filter((o) => ['confirmed', 'dispatched', 'delivered'].includes(o.status))
                      .map((o) => (
                        <tr key={o.id}>
                          <td className="order-id-cell">{o.id}</td>
                          <td>{o.distributorName}</td>
                          <td>
                            <span className={`status-pill ${o.status}`}>{o.status.toUpperCase()}</span>
                          </td>
                          <td style={{ fontWeight: '700' }}>${o.total?.toFixed(2)}</td>
                          <td style={{ color: 'var(--status-pending)', fontWeight: '700' }}>+{o.pointsAwarded} pts</td>
                          <td>
                            <button
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              onClick={() => setSelectedOrderDetails(o)}
                            >
                              View {o.items?.length || 0} Items
                            </button>
                          </td>
                          <td>
                            {o.status === 'confirmed' && (
                              <button
                                id={`btn-dispatch-${o.id}`}
                                className="btn-primary"
                                style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                                onClick={() => handleOrderStatusTransition(o.id, 'dispatched')}
                              >
                                📦 Dispatch (Deduct Stock)
                              </button>
                            )}
                            {o.status === 'dispatched' && (
                              <button
                                id={`btn-deliver-${o.id}`}
                                className="btn-success"
                                onClick={() => handleOrderStatusTransition(o.id, 'delivered')}
                              >
                                🏁 Mark Delivered
                              </button>
                            )}
                            {o.status === 'delivered' && (
                              <span style={{ color: 'var(--status-delivered)', fontWeight: '700', fontSize: '0.8rem' }}>
                                ✓ Completed & Delivered
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ORDER ITEMS DETAILS MODAL */}
      {selectedOrderDetails && (
        <div className="modal-overlay" onClick={() => setSelectedOrderDetails(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Order Breakdown: {selectedOrderDetails.id}</h3>
              <button className="modal-close-btn" onClick={() => setSelectedOrderDetails(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</div>
                  <span className={`status-pill ${selectedOrderDetails.status}`}>
                    {selectedOrderDetails.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Distributor</div>
                  <div style={{ fontWeight: '700' }}>{selectedOrderDetails.distributorName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Discount Rate</div>
                  <div style={{ color: 'var(--status-confirmed)', fontWeight: '700' }}>
                    {(selectedOrderDetails.discountRate * 100).toFixed(0)}% (-${selectedOrderDetails.discountAmount?.toFixed(2)})
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Points Awarded</div>
                  <div style={{ color: 'var(--status-pending)', fontWeight: '700' }}>
                    +{selectedOrderDetails.pointsAwarded} pts
                  </div>
                </div>
              </div>

              <h4 style={{ fontSize: '0.95rem', fontWeight: '800', marginTop: '0.5rem' }}>Line Items:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedOrderDetails.items?.map((it, idx) => (
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

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '2rem', fontSize: '1.1rem' }}>
                <span>Subtotal: ${selectedOrderDetails.subtotal?.toFixed(2)}</span>
                <strong>Total: ${selectedOrderDetails.total?.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM FLOWCHART & ARCHITECTURE MODAL */}
      {showFlowchartModal && (
        <div className="modal-overlay" onClick={() => setShowFlowchartModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📊 State Machine & Invariants Architecture</h3>
              <button className="modal-close-btn" onClick={() => setShowFlowchartModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.75rem', fontWeight: '800' }}>Order Status Transitions (State Diagram v2)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="status-pill placed">PLACED</span>
                    <span>→</span>
                    <span className="status-pill confirmed">CONFIRMED</span>
                    <span style={{ color: 'var(--text-muted)' }}>(If Order Total ≤ Available Credit. Stock reserved, points auto-awarded)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="status-pill placed">PLACED</span>
                    <span>→</span>
                    <span className="status-pill pendingApproval">PENDING APPROVAL</span>
                    <span style={{ color: 'var(--text-muted)' }}>(If Order Total &gt; Available Credit. Stock reserved, awaiting manager)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="status-pill pendingApproval">PENDING APPROVAL</span>
                    <span>→</span>
                    <span className="status-pill confirmed">CONFIRMED</span>
                    <span style={{ color: 'var(--text-muted)' }}>(Sales Manager Approves. Points awarded, tier recalculated)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="status-pill pendingApproval">PENDING APPROVAL</span>
                    <span>→</span>
                    <span className="status-pill rejected">REJECTED</span>
                    <span style={{ color: 'var(--text-muted)' }}>(Sales Manager Rejects. Reserved stock released)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="status-pill confirmed">CONFIRMED</span>
                    <span>→</span>
                    <span className="status-pill dispatched">DISPATCHED</span>
                    <span style={{ color: 'var(--text-muted)' }}>(Stock permanently deducted from warehouse inventory)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="status-pill dispatched">DISPATCHED</span>
                    <span>→</span>
                    <span className="status-pill delivered">DELIVERED</span>
                    <span style={{ color: 'var(--text-muted)' }}>(Final order completion)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="status-pill confirmed">CONFIRMED</span>
                    <span>→</span>
                    <span className="status-pill cancelled">CANCELLED</span>
                    <span style={{ color: 'var(--status-rejected)' }}>(R1: Releases stock. R5: Reverses awarded points & recalculates tier!)</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ color: 'var(--status-pending)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '800' }}>Loyalty Tiers (B2, R2, R4, R5)</h4>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li><strong>Bronze</strong>: 0 - 999 pts in trailing 90 days → 0% discount</li>
                    <li><strong>Silver</strong>: 1000 - 4999 pts in trailing 90 days → 3% discount</li>
                    <li><strong>Gold</strong>: 5000+ pts in trailing 90 days → 6% discount</li>
                    <li>Points = <code>floor(Total / 100)</code> awarded on entering confirmed</li>
                    <li>Tier discount locked at placement; future tier shifts do not alter placed orders</li>
                  </ul>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ color: 'var(--status-confirmed)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '800' }}>Stock & Credit Rules (R1, R3)</h4>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li><strong>R1</strong>: Stock reserved on order placed. Deducted on dispatch.</li>
                    <li><strong>R1</strong>: Insufficient stock rejects order identifying SKU & available qty.</li>
                    <li><strong>R1</strong>: Cancel/Reject releases reserved stock exactly once.</li>
                    <li><strong>R3</strong>: Available Credit = Credit Limit - Active Orders total.</li>
                    <li>Active orders = all orders NOT in delivered, cancelled, or rejected.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Alert */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
