import React from 'react';

export default function Navbar({
  theme,
  toggleTheme,
  activeRole,
  setActiveRole,
  activeTab,
  setActiveTab,
  distributors,
  selectedDistributorId,
  setSelectedDistributorId,
  productsCount,
  distributorOrdersCount,
  onOpenFlowchart,
  onResetSeed,
}) {
  return (
    <>
      <header className="app-header">
        {/* Brand */}
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

          {/* Flowchart Modal Button */}
          <button
            id="open-flowchart-btn"
            className="btn-secondary"
            onClick={onOpenFlowchart}
            title="View State Machine & Architecture Flowchart"
          >
            📊 Flowchart
          </button>

          {/* Database Reset Seed Button */}
          <button
            id="reset-seed-btn"
            className="btn-secondary"
            onClick={onResetSeed}
            title="Reset Database to initial B5 seed state"
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
              📦 Product Catalogue ({productsCount})
            </button>
            <button
              id="tab-orders-btn"
              className={`role-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              📜 Order History ({distributorOrdersCount})
            </button>
          </div>
        </div>
      )}
    </>
  );
}
