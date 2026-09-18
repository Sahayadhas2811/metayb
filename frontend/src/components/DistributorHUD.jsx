import React from 'react';

export default function DistributorHUD({ distributor }) {
  if (!distributor) return null;

  const creditLimit = distributor.creditLimit || 0;
  const availableCredit = distributor.availableCredit || 0;
  const exposure = distributor.exposure || 0;
  const loyaltyTier = distributor.loyaltyTier || 'Bronze';
  const discountRate = distributor.discountRate || 0;
  const trailingPoints = distributor.trailingPoints || 0;

  // Utilization calculation
  const usedCredit = Math.max(0, creditLimit - availableCredit);
  const utilizationPct = creditLimit > 0 ? Math.min(100, Math.max(0, (usedCredit / creditLimit) * 100)) : 0;

  return (
    <section className="distributor-overview-grid">
      {/* Credit Limit Card */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-label">Credit Limit (Currency)</span>
          <span style={{ fontSize: '1.2rem' }}>💳</span>
        </div>
        <div className="metric-value">${creditLimit.toLocaleString()}</div>
        <div className="metric-subtext">Total credit line assigned to your account in database</div>
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
            color: availableCredit > 1000 ? 'var(--status-confirmed)' : availableCredit < 0 ? 'var(--status-rejected)' : 'var(--status-pending)',
          }}
        >
          ${availableCredit.toLocaleString()}
        </div>
        <div className="progress-bar-bg">
          <div
            className="progress-bar-fill"
            style={{
              width: `${utilizationPct}%`,
              background: availableCredit < 1000 ? 'var(--status-pending)' : 'var(--accent-blue)',
            }}
          />
        </div>
        <div className="metric-subtext" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
          <span>Exposure: ${exposure.toLocaleString()}</span>
          <span>Active Orders</span>
        </div>
      </div>

      {/* Loyalty Tier & Discount (B2, R2) */}
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-label">Current Loyalty Tier</span>
          <span className={`tier-badge ${loyaltyTier.toLowerCase()}`}>
            {loyaltyTier}
          </span>
        </div>
        <div className="metric-value">
          {discountRate > 0 ? `${(discountRate * 100).toFixed(0)}% OFF` : '0% (Standard)'}
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
          {trailingPoints.toLocaleString()} pts
        </div>
        <div className="metric-subtext">
          {loyaltyTier === 'Gold'
            ? 'Top Tier (5000+ points) - 6% discount unlocked'
            : loyaltyTier === 'Silver'
            ? `${Math.max(0, 5000 - trailingPoints)} pts until Gold tier (6%)`
            : `${Math.max(0, 1000 - trailingPoints)} pts until Silver tier (3%)`}
        </div>
      </div>
    </section>
  );
}
