const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const {
  getProducts,
  getDistributors,
  getOrders,
  placeOrder,
  transitionOrderStatus,
} = require('../services/orderService');

// Health Check
router.get('/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW() AS current_time');
    res.json({
      status: 'UP',
      database: 'connected',
      timestamp: dbRes.rows[0].current_time,
    });
  } catch (err) {
    res.status(500).json({ status: 'DOWN', error: err.message });
  }
});

// Catalogue: List all products with available stock
router.get('/products', async (req, res) => {
  try {
    const products = await getProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Distributors: List with credit limit, available credit, points balance, and loyalty tier
router.get('/distributors', async (req, res) => {
  try {
    const distributors = await getDistributors();
    res.json(distributors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Orders: List all orders or filtered by distributor
router.get('/orders', async (req, res) => {
  try {
    const { distributorId } = req.query;
    const orders = await getOrders(distributorId);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Place Order
router.post('/orders', async (req, res) => {
  try {
    const { distributorId, items } = req.body;
    if (!distributorId) {
      return res.status(400).json({ error: 'distributorId is required.' });
    }
    const orderResult = await placeOrder({ distributorId, items });
    res.status(201).json(orderResult);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message,
      code: err.code || 'ORDER_PLACEMENT_ERROR',
      sku: err.sku,
      available: err.available,
      requested: err.requested,
    });
  }
});

// Transition Order Status
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetStatus, actorRole } = req.body;
    if (!targetStatus) {
      return res.status(400).json({ error: 'targetStatus is required.' });
    }
    const result = await transitionOrderStatus({
      orderId: id,
      targetStatus,
      actorRole,
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// Reset Seed Data (Useful for interactive testing)
router.post('/reset-seed', async (req, res) => {
  try {
    const seedPath = path.join(__dirname, '../sql/seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await pool.query(seedSql);
    res.json({ message: 'Seed data successfully reloaded.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
