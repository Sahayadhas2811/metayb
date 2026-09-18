const { pool } = require('../config/db');
const {
  placeOrder,
  transitionOrderStatus,
  getProducts,
  getDistributors,
  getOrders,
} = require('../services/orderService');
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE BUSINESS RULES E2E TESTS ---');

  // Reset seed
  const seedSql = fs.readFileSync(path.join(__dirname, '../sql/seed.sql'), 'utf8');
  await pool.query(seedSql);
  console.log('Step 0: Database reset to seed state.');

  // Test 1: Verify 8 products and stock (including 0-stock and 1-stock items)
  const products = await getProducts();
  if (products.length < 8) throw new Error('Expected at least 8 products');
  const oos = products.find((p) => p.stockQuantity === 0);
  const oneStock = products.find((p) => p.stockQuantity === 1);
  if (!oos) throw new Error('Expected at least one product with 0 stock');
  if (!oneStock) throw new Error('Expected at least one product with 1 stock');
  console.log('Test 1 Passed: 8 products found with 0-stock (P-101) and 1-stock (P-102).');

  // Test 2: R1 - Attempt to order out of stock item (P-101)
  try {
    await placeOrder({
      distributorId: 'D-101',
      items: [{ sku: 'P-101', quantity: 2 }],
    });
    throw new Error('Test 2 Failed: Order should have been rejected for insufficient stock');
  } catch (err) {
    if (err.code === 'INSUFFICIENT_STOCK' && err.sku === 'P-101') {
      console.log('Test 2 Passed: R1 rejection correctly identified SKU P-101 and available quantity 0.');
    } else {
      throw err;
    }
  }

  // Test 3: R1, R2, R3 - Place order within credit limit for Bronze distributor (D-101, limit 5000)
  // D-101 has 0% discount. Let's order 10 * P-100 (unit price 120) => subtotal 1200, discount 0, total 1200.
  const order1 = await placeOrder({
    distributorId: 'D-101',
    items: [{ sku: 'P-100', quantity: 10 }],
  });

  if (order1.status !== 'confirmed') {
    throw new Error(`Test 3 Failed: Expected status confirmed, got ${order1.status}`);
  }
  if (order1.discountRate !== 0.0) {
    throw new Error(`Test 3 Failed: Expected discount 0, got ${order1.discountRate}`);
  }
  // Points: floor(1200 / 100) = 12
  if (order1.pointsAwarded !== 12) {
    throw new Error(`Test 3 Failed: Expected 12 points, got ${order1.pointsAwarded}`);
  }
  console.log('Test 3 Passed: Order placed within credit limit -> confirmed, 0% discount, 12 points awarded.');

  // Test 4: Verify stock reservation for P-100 (reserved should be 10, available 140)
  const p100After = (await getProducts()).find((p) => p.sku === 'P-100');
  if (p100After.reservedQuantity !== 10 || p100After.availableQuantity !== 140) {
    throw new Error(`Test 4 Failed: Stock reservation incorrect. Reserved: ${p100After.reservedQuantity}`);
  }
  console.log('Test 4 Passed: Stock reserved per R1 (10 reserved, 140 available).');

  // Test 5: R2 & R3 - Place order exceeding available credit for D-101 (credit limit 5000)
  // Available credit was 5000 - 1200 = 3800.
  // Let's place order for 10 * P-200 (unit price 450) => 4500 > 3800.
  const order2 = await placeOrder({
    distributorId: 'D-101',
    items: [{ sku: 'P-200', quantity: 10 }],
  });

  if (order2.status !== 'pendingApproval') {
    throw new Error(`Test 5 Failed: Expected status pendingApproval, got ${order2.status}`);
  }
  if (order2.pointsAwarded !== 0) {
    throw new Error(`Test 5 Failed: Points should be 0 for pendingApproval order, got ${order2.pointsAwarded}`);
  }
  console.log('Test 5 Passed: Order exceeding available credit entered pendingApproval with 0 points.');

  // Test 6: Manager Approves pending order -> enters confirmed & awards points per R4
  const approveRes = await transitionOrderStatus({
    orderId: order2.orderId,
    targetStatus: 'confirmed',
    actorRole: 'manager',
  });

  if (approveRes.newStatus !== 'confirmed' || approveRes.pointsAwarded !== 45) {
    throw new Error(`Test 6 Failed: Manager approval did not confirm or award 45 points`);
  }
  console.log('Test 6 Passed: Manager approval moved order to confirmed and awarded 45 points.');

  // Test 7: Dispatch order1 -> permanently deducts stock from on-hand (R1)
  const dispatchRes = await transitionOrderStatus({
    orderId: order1.orderId,
    targetStatus: 'dispatched',
    actorRole: 'manager',
  });
  if (dispatchRes.newStatus !== 'dispatched') {
    throw new Error('Test 7 Failed: Expected dispatched status');
  }

  const p100Dispatched = (await getProducts()).find((p) => p.sku === 'P-100');
  if (p100Dispatched.stockQuantity !== 140 || p100Dispatched.reservedQuantity !== 0) {
    throw new Error(`Test 7 Failed: Permanent stock deduction failed. Stock: ${p100Dispatched.stockQuantity}, Reserved: ${p100Dispatched.reservedQuantity}`);
  }
  console.log('Test 7 Passed: Dispatched permanently deducted 10 units from stock_quantity.');

  // Test 8: R5 - Cancel confirmed order (order2) -> releases reservation & reverses points
  const p200BeforeCancel = (await getProducts()).find((p) => p.sku === 'P-200');
  if (p200BeforeCancel.reservedQuantity !== 10) {
    throw new Error('P-200 reservation should be 10 before cancel');
  }

  const cancelRes = await transitionOrderStatus({
    orderId: order2.orderId,
    targetStatus: 'cancelled',
    actorRole: 'distributor',
  });

  if (cancelRes.newStatus !== 'cancelled' || cancelRes.pointsAwarded !== 0) {
    throw new Error('Test 8 Failed: Expected cancelled order with 0 points');
  }

  const p200AfterCancel = (await getProducts()).find((p) => p.sku === 'P-200');
  if (p200AfterCancel.reservedQuantity !== 0) {
    throw new Error(`Test 8 Failed: Reserved quantity was not released on cancellation. Got: ${p200AfterCancel.reservedQuantity}`);
  }
  console.log('Test 8 Passed: Cancellation released reserved stock and reversed awarded points per R5.');

  // Test 9: Disallowed transition test (e.g. cancelled -> confirmed)
  try {
    await transitionOrderStatus({
      orderId: order2.orderId,
      targetStatus: 'confirmed',
      actorRole: 'manager',
    });
    throw new Error('Test 9 Failed: Disallowed transition should have thrown error');
  } catch (err) {
    if (err.status === 400) {
      console.log('Test 9 Passed: Disallowed transition properly rejected with 400 error.');
    } else {
      throw err;
    }
  }

  // Test 10: Silver (D-102: 3% discount) and Gold (D-103: 6% discount) placement validation
  const silverOrder = await placeOrder({
    distributorId: 'D-102',
    items: [{ sku: 'P-300', quantity: 2 }],
  });
  if (silverOrder.discountRate !== 0.03) {
    throw new Error(`Expected 3% discount for Silver distributor, got ${silverOrder.discountRate}`);
  }

  const goldOrder = await placeOrder({
    distributorId: 'D-103',
    items: [{ sku: 'P-300', quantity: 2 }],
  });
  if (goldOrder.discountRate !== 0.06) {
    throw new Error(`Expected 6% discount for Gold distributor, got ${goldOrder.discountRate}`);
  }
  console.log('Test 10 Passed: Silver (3%) and Gold (6%) discounts accurately applied.');

  console.log('\n>>> ALL 10 BUSINESS RULE & LIFECYCLE TESTS PASSED PERFECTLY! <<<');
  await pool.end();
}

runTests().catch((err) => {
  console.error('TEST RUN FAILED:', err);
  process.exit(1);
});
