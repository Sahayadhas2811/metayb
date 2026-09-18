import React from 'react';

export default function SalesManagerBoard({
  orders,
  distributors,
  onSelectOrderDetails,
  onTransitionStatus,
}) {
  const pendingOrders = orders.filter((o) => o.status === 'pendingApproval');
  const fulfillmentOrders = orders.filter((o) => ['confirmed', 'dispatched', 'delivered'].includes(o.status));
  const confirmedCount = orders.filter((o) => o.status === 'confirmed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Manager Header & KPI Cards */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            👔 Sales Manager Control Board
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Logged in as <strong>Ava Sterling</strong> (ava.manager@metayb.com) • Authority to Override Credit Approvals & Dispatch Warehouse Stock
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: 'var(--status-pending)', textTransform: 'uppercase', fontWeight: '700' }}>
              Pending Approval
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {pendingOrders.length}
            </div>
          </div>
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: 'var(--status-confirmed)', textTransform: 'uppercase', fontWeight: '700' }}>
              Ready for Dispatch
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {confirmedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Pending Approvals Queue (R3, B3) */}
      <div>
        <div className="section-header">
          <h3 className="section-title">⚠️ Orders Pending Manager Approval (Credit Exceeded)</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Orders whose total exceeded the distributor's available credit limit in database
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
              {pendingOrders.map((o) => {
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
                        onClick={() => onSelectOrderDetails(o)}
                      >
                        View {o.items?.length || 0} Items
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          id={`btn-approve-${o.id}`}
                          className="btn-success"
                          onClick={() => onTransitionStatus(o.id, 'confirmed')}
                          title="Approve Order and Award Loyalty Points"
                        >
                          ✓ Approve (Confirm)
                        </button>
                        <button
                          id={`btn-reject-${o.id}`}
                          className="btn-danger"
                          onClick={() => onTransitionStatus(o.id, 'rejected')}
                          title="Reject Order and Release Reserved Stock"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pendingOrders.length === 0 && (
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
          <h3 className="section-title">🚚 Warehouse Fulfillment & Dispatch Board</h3>
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
              {fulfillmentOrders.map((o) => (
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
                      onClick={() => onSelectOrderDetails(o)}
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
                        onClick={() => onTransitionStatus(o.id, 'dispatched')}
                      >
                        📦 Dispatch (Deduct Stock)
                      </button>
                    )}
                    {o.status === 'dispatched' && (
                      <button
                        id={`btn-deliver-${o.id}`}
                        className="btn-success"
                        onClick={() => onTransitionStatus(o.id, 'delivered')}
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
              {fulfillmentOrders.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No confirmed, dispatched, or delivered orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
