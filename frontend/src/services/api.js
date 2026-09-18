/**
 * MetaYB API Client
 * Connects directly to backend REST endpoints on Express + PostgreSQL 17
 */

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Backend health check failed');
  return res.json();
}

export async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch products catalogue from database');
  }
  return res.json();
}

export async function fetchDistributors() {
  const res = await fetch(`${API_BASE}/distributors`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch distributors from database');
  }
  return res.json();
}

export async function fetchOrders(distributorId = null) {
  const url = distributorId ? `${API_BASE}/orders?distributorId=${distributorId}` : `${API_BASE}/orders`;
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch orders from database');
  }
  return res.json();
}

export async function placeOrder({ distributorId, items }) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ distributorId, items }),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Failed to place order');
    err.status = res.status;
    err.code = data.code;
    err.sku = data.sku;
    err.available = data.available;
    err.requested = data.requested;
    throw err;
  }
  return data;
}

export async function transitionOrderStatus({ orderId, targetStatus, actorRole = 'system' }) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetStatus, actorRole }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Failed to transition order status to ${targetStatus}`);
  }
  return data;
}

export async function resetDatabaseSeed() {
  const res = await fetch(`${API_BASE}/reset-seed`, {
    method: 'POST',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reset database seed');
  }
  return data;
}
