const { pool } = require('../config/db');

// Map tier to discount rate
function getDiscountRateForTier(tier) {
  switch (tier) {
    case 'Gold':
      return 0.06;
    case 'Silver':
      return 0.03;
    case 'Bronze':
    default:
      return 0.00;
  }
}

// Compute tier from 90-day points
function computeTierFromPoints(points) {
  if (points >= 5000) return 'Gold';
  if (points >= 1000) return 'Silver';
  return 'Bronze';
}

// Calculate trailing 90-day points and recalculate distributor's tier
async function recalculateDistributorTier(client, distributorId) {
  const pointsRes = await client.query(
    `SELECT COALESCE(SUM(points_delta), 0) AS total_points
     FROM loyalty_points_ledger
     WHERE distributor_id = $1
       AND created_at >= NOW() - INTERVAL '90 days'`,
    [distributorId]
  );

  const trailingPoints = parseInt(pointsRes.rows[0].total_points, 10);
  const newTier = computeTierFromPoints(trailingPoints);

  await client.query(
    `UPDATE distributors
     SET loyalty_tier = $1
     WHERE id = $2`,
    [newTier, distributorId]
  );

  return { trailingPoints, newTier };
}

// Compute available credit per R3:
// available credit = credit limit - sum of total of distributor's orders NOT in ('delivered', 'cancelled', 'rejected')
async function getAvailableCredit(client, distributorId) {
  const distRes = await client.query(
    `SELECT credit_limit FROM distributors WHERE id = $1`,
    [distributorId]
  );

  if (distRes.rowCount === 0) {
    throw new Error(`Distributor ${distributorId} not found`);
  }

  const creditLimit = parseFloat(distRes.rows[0].credit_limit);

  const ordersRes = await client.query(
    `SELECT COALESCE(SUM(total), 0) AS exposure
     FROM orders
     WHERE distributor_id = $1
       AND status NOT IN ('delivered', 'cancelled', 'rejected')`,
    [distributorId]
  );

  const exposure = parseFloat(ordersRes.rows[0].exposure);
  const availableCredit = creditLimit - exposure;

  return { creditLimit, exposure, availableCredit };
}

// Place a new order with atomic stock reservation and credit check
async function placeOrder({ distributorId, items }) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Order must contain at least one line item.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch Distributor details
    const distRes = await client.query(
      `SELECT id, name, credit_limit, loyalty_tier FROM distributors WHERE id = $1 FOR UPDATE`,
      [distributorId]
    );

    if (distRes.rowCount === 0) {
      throw new Error(`Distributor ${distributorId} not found.`);
    }

    const distributor = distRes.rows[0];
    const currentTier = distributor.loyalty_tier;
    const discountRate = getDiscountRateForTier(currentTier); // Fixed at placement (R2)

    // 2. Validate line items and stock availability per R1
    const skus = items.map((i) => i.sku);
    const prodRes = await client.query(
      `SELECT sku, name, unit_price, stock_quantity, reserved_quantity
       FROM products
       WHERE sku = ANY($1)
       FOR UPDATE`,
      [skus]
    );

    const productMap = new Map();
    prodRes.rows.forEach((p) => productMap.set(p.sku, p));

    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const product = productMap.get(item.sku);
      if (!product) {
        throw new Error(`Product SKU ${item.sku} does not exist.`);
      }

      const requestedQty = parseInt(item.quantity, 10);
      if (isNaN(requestedQty) || requestedQty <= 0) {
        throw new Error(`Invalid quantity for SKU ${item.sku}. Quantity must be > 0.`);
      }

      const availableStock = product.stock_quantity - product.reserved_quantity;

      // Rule R1: If any line item cannot be fully reserved, the order is rejected
      if (requestedQty > availableStock) {
        throw {
          status: 400,
          code: 'INSUFFICIENT_STOCK',
          message: `Cannot reserve SKU ${item.sku} (${product.name}). Requested: ${requestedQty}, Available: ${availableStock}.`,
          sku: item.sku,
          requested: requestedQty,
          available: availableStock,
        };
      }

      const unitPrice = parseFloat(product.unit_price);
      const lineTotal = unitPrice * requestedQty;
      subtotal += lineTotal;

      processedItems.push({
        sku: item.sku,
        name: product.name,
        quantity: requestedQty,
        unitPrice,
        lineTotal,
      });
    }

    // 3. Compute discount and total
    subtotal = Math.round(subtotal * 100) / 100;
    const discountAmount = Math.round(subtotal * discountRate * 100) / 100;
    const total = Math.round((subtotal - discountAmount) * 100) / 100;

    // 4. Reserve stock per R1
    for (const item of processedItems) {
      await client.query(
        `UPDATE products
         SET reserved_quantity = reserved_quantity + $1
         WHERE sku = $2`,
        [item.quantity, item.sku]
      );
    }

    // 5. Credit check per R3
    // available credit = credit limit - sum of total of distributor's orders NOT in ('delivered', 'cancelled', 'rejected')
    const exposureRes = await client.query(
      `SELECT COALESCE(SUM(total), 0) AS exposure
       FROM orders
       WHERE distributor_id = $1
         AND status NOT IN ('delivered', 'cancelled', 'rejected')`,
      [distributorId]
    );

    const creditLimit = parseFloat(distributor.credit_limit);
    const existingExposure = parseFloat(exposureRes.rows[0].exposure);
    const availableCredit = creditLimit - existingExposure;

    let initialStatus = 'confirmed';
    let pointsToAward = 0;

    if (total > availableCredit) {
      // Exceeds available credit -> enters pendingApproval
      initialStatus = 'pendingApproval';
    } else {
      // Within credit -> confirmed. Award points per B2 & R4
      initialStatus = 'confirmed';
      pointsToAward = Math.floor(total / 100);
    }

    // Generate Order ID
    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Insert Order record
    await client.query(
      `INSERT INTO orders (id, distributor_id, status, subtotal, discount_rate, discount_amount, total, points_awarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orderId, distributorId, initialStatus, subtotal, discountRate, discountAmount, total, pointsToAward]
    );

    // Insert Order Line Items
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, sku, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.sku, item.quantity, item.unitPrice, item.lineTotal]
      );
    }

    // If order confirmed immediately, record points in ledger and recalculate tier
    let tierInfo = null;
    if (initialStatus === 'confirmed' && pointsToAward > 0) {
      await client.query(
        `INSERT INTO loyalty_points_ledger (distributor_id, order_id, points_delta, reason)
         VALUES ($1, $2, $3, 'ORDER_CONFIRMED_AWARD')`,
        [distributorId, orderId, pointsToAward]
      );

      tierInfo = await recalculateDistributorTier(client, distributorId);
    }

    await client.query('COMMIT');

    return {
      orderId,
      distributorId,
      status: initialStatus,
      subtotal,
      discountRate,
      discountAmount,
      total,
      pointsAwarded: pointsToAward,
      items: processedItems,
      creditCheck: {
        creditLimit,
        existingExposure,
        availableCredit,
        exceeded: total > availableCredit,
      },
      tierInfo,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Transition Order Status per State Diagram v2 and Business Rules
async function transitionOrderStatus({ orderId, targetStatus, actorRole = 'system' }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch order
    const orderRes = await client.query(
      `SELECT id, distributor_id, status, total, points_awarded
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      throw { status: 404, message: `Order ${orderId} not found.` };
    }

    const order = orderRes.rows[0];
    const currentStatus = order.status;

    // 2. Validate Allowed Transitions per State Diagram v2:
    // placed -> confirmed (done on placement)
    // placed -> pendingApproval (done on placement)
    // placed -> cancelled
    // pendingApproval -> confirmed (Manager approves)
    // pendingApproval -> rejected (Manager rejects)
    // pendingApproval -> cancelled
    // confirmed -> dispatched
    // confirmed -> cancelled
    // dispatched -> delivered
    const allowedTransitions = {
      placed: ['confirmed', 'pendingApproval', 'cancelled'],
      pendingApproval: ['confirmed', 'rejected', 'cancelled'],
      confirmed: ['dispatched', 'cancelled'],
      dispatched: ['delivered'],
      delivered: [],
      rejected: [],
      cancelled: [],
    };

    const permittedTargets = allowedTransitions[currentStatus] || [];
    if (!permittedTargets.includes(targetStatus)) {
      throw {
        status: 400,
        message: `Invalid state transition from "${currentStatus}" to "${targetStatus}". Permitted transitions: [${permittedTargets.join(', ')}]`,
      };
    }

    // Fetch order items to manage stock reservation/deduction
    const itemsRes = await client.query(
      `SELECT sku, quantity FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const items = itemsRes.rows;

    let pointsDelta = 0;
    let newPointsAwarded = order.points_awarded;

    // Execute state transition logic:
    if (currentStatus === 'pendingApproval' && targetStatus === 'confirmed') {
      // Manager approves pending order:
      // Award points per B2 & R4
      const pointsToAward = Math.floor(parseFloat(order.total) / 100);
      newPointsAwarded = pointsToAward;

      if (pointsToAward > 0) {
        await client.query(
          `INSERT INTO loyalty_points_ledger (distributor_id, order_id, points_delta, reason)
           VALUES ($1, $2, $3, 'MANAGER_APPROVAL_CONFIRMED_AWARD')`,
          [order.distributor_id, orderId, pointsToAward]
        );
      }
    } else if (
      (currentStatus === 'pendingApproval' && targetStatus === 'rejected') ||
      (currentStatus === 'pendingApproval' && targetStatus === 'cancelled') ||
      (currentStatus === 'placed' && targetStatus === 'cancelled')
    ) {
      // Cancellation or rejection before dispatched releases the reservation exactly once (R1)
      for (const item of items) {
        await client.query(
          `UPDATE products
           SET reserved_quantity = GREATEST(0, reserved_quantity - $1)
           WHERE sku = $2`,
          [item.quantity, item.sku]
        );
      }
    } else if (currentStatus === 'confirmed' && targetStatus === 'dispatched') {
      // Permanently deducted when dispatched (R1)
      // Stock quantity reduced by item quantity, reserved quantity released
      for (const item of items) {
        await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity - $1,
               reserved_quantity = GREATEST(0, reserved_quantity - $1)
           WHERE sku = $2`,
          [item.quantity, item.sku]
        );
      }
    } else if (currentStatus === 'confirmed' && targetStatus === 'cancelled') {
      // Cancelling a confirmed order:
      // 1. Release reserved stock (R1)
      for (const item of items) {
        await client.query(
          `UPDATE products
           SET reserved_quantity = GREATEST(0, reserved_quantity - $1)
           WHERE sku = $2`,
          [item.quantity, item.sku]
        );
      }

      // 2. Reverse points it awarded per R5
      if (order.points_awarded > 0) {
        pointsDelta = -order.points_awarded;
        await client.query(
          `INSERT INTO loyalty_points_ledger (distributor_id, order_id, points_delta, reason)
           VALUES ($1, $2, $3, 'ORDER_CANCELLATION_POINTS_REVERSAL')`,
          [order.distributor_id, orderId, pointsDelta]
        );
        newPointsAwarded = 0;
      }
    }

    // Update order status in DB
    await client.query(
      `UPDATE orders
       SET status = $1, points_awarded = $2, updated_at = NOW()
       WHERE id = $3`,
      [targetStatus, newPointsAwarded, orderId]
    );

    // Recalculate distributor tier if points changed (R5)
    let tierInfo = null;
    if (
      (currentStatus === 'pendingApproval' && targetStatus === 'confirmed') ||
      (currentStatus === 'confirmed' && targetStatus === 'cancelled')
    ) {
      tierInfo = await recalculateDistributorTier(client, order.distributor_id);
    }

    await client.query('COMMIT');

    return {
      orderId,
      previousStatus: currentStatus,
      newStatus: targetStatus,
      pointsAwarded: newPointsAwarded,
      tierInfo,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Read queries for catalogue, distributors, and order list
async function getProducts() {
  const res = await pool.query(
    `SELECT sku, name, unit_price, stock_quantity, reserved_quantity,
            (stock_quantity - reserved_quantity) AS available_quantity
     FROM products
     ORDER BY sku ASC`
  );
  return res.rows.map((r) => ({
    sku: r.sku,
    name: r.name,
    unitPrice: parseFloat(r.unit_price),
    stockQuantity: parseInt(r.stock_quantity, 10),
    reservedQuantity: parseInt(r.reserved_quantity, 10),
    availableQuantity: parseInt(r.available_quantity, 10),
  }));
}

async function getDistributors() {
  const res = await pool.query(
    `SELECT d.id, d.name, d.credit_limit, d.loyalty_tier,
            COALESCE(SUM(l.points_delta), 0) AS trailing_points
     FROM distributors d
     LEFT JOIN loyalty_points_ledger l
       ON d.id = l.distributor_id
      AND l.created_at >= NOW() - INTERVAL '90 days'
     GROUP BY d.id, d.name, d.credit_limit, d.loyalty_tier
     ORDER BY d.id ASC`
  );

  const distributorsWithCredit = [];
  for (const d of res.rows) {
    const { exposure, availableCredit } = await getAvailableCredit(pool, d.id);
    distributorsWithCredit.push({
      id: d.id,
      name: d.name,
      creditLimit: parseFloat(d.credit_limit),
      exposure,
      availableCredit,
      loyaltyTier: d.loyalty_tier,
      trailingPoints: parseInt(d.trailing_points, 10),
      discountRate: getDiscountRateForTier(d.loyalty_tier),
    });
  }

  return distributorsWithCredit;
}

async function getOrders(distributorId = null) {
  let query = `
    SELECT o.id, o.distributor_id, d.name AS distributor_name, o.status,
           o.subtotal, o.discount_rate, o.discount_amount, o.total,
           o.points_awarded, o.created_at, o.updated_at
    FROM orders o
    JOIN distributors d ON o.distributor_id = d.id
  `;
  const params = [];

  if (distributorId) {
    query += ` WHERE o.distributor_id = $1`;
    params.push(distributorId);
  }

  query += ` ORDER BY o.created_at DESC`;

  const ordersRes = await pool.query(query, params);

  // Fetch items for each order
  const orderIds = ordersRes.rows.map((o) => o.id);
  let itemMap = new Map();

  if (orderIds.length > 0) {
    const itemsRes = await pool.query(
      `SELECT oi.order_id, oi.sku, p.name, oi.quantity, oi.unit_price, oi.line_total
       FROM order_items oi
       JOIN products p ON oi.sku = p.sku
       WHERE oi.order_id = ANY($1)
       ORDER BY oi.id ASC`,
      [orderIds]
    );

    for (const item of itemsRes.rows) {
      if (!itemMap.has(item.order_id)) {
        itemMap.set(item.order_id, []);
      }
      itemMap.get(item.order_id).push({
        sku: item.sku,
        name: item.name,
        quantity: parseInt(item.quantity, 10),
        unitPrice: parseFloat(item.unit_price),
        lineTotal: parseFloat(item.line_total),
      });
    }
  }

  return ordersRes.rows.map((o) => ({
    id: o.id,
    distributorId: o.distributor_id,
    distributorName: o.distributor_name,
    status: o.status,
    subtotal: parseFloat(o.subtotal),
    discountRate: parseFloat(o.discount_rate),
    discountAmount: parseFloat(o.discount_amount),
    total: parseFloat(o.total),
    pointsAwarded: parseInt(o.points_awarded, 10),
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    items: itemMap.get(o.id) || [],
  }));
}

module.exports = {
  getProducts,
  getDistributors,
  getOrders,
  placeOrder,
  transitionOrderStatus,
  getAvailableCredit,
  recalculateDistributorTier,
};
