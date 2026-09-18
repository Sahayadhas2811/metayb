import React from 'react';

export default function OrderHistory({
  distributor,
  orders,
  onSelectOrderDetails,
  onCancelOrder,
}) {
  const distributorOrders = orders.filter((o) => o.distributorId === distributor?.id);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">📜 Your Order History ({distributor?.name})</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Track order transitions, reserved stock, and awarded loyalty points directly from the database
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
            {distributorOrders.map((o) => (
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
                    onClick={() => onSelectOrderDetails(o)}
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
                      onClick={() => onCancelOrder(o)}
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
            {distributorOrders.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No orders found for this distributor in the database.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
