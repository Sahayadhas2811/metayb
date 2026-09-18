-- Seed data per requirement B5

-- Clear tables in reverse dependency order
DELETE FROM loyalty_points_ledger;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM sales_managers;
DELETE FROM distributors;
DELETE FROM products;

-- 8 Products (including one with stock 0, one with stock 1)
INSERT INTO products (sku, name, unit_price, stock_quantity, reserved_quantity) VALUES
('P-101', 'Eco Laundry Powder', 250.00, 0, 0),         -- STOCK 0
('P-102', 'Nutri-Crisp Cereal Box', 180.00, 1, 0),      -- STOCK 1
('P-100', 'Premium Antibacterial Soap', 120.00, 150, 0),
('P-200', 'Royal Basmati Rice 5kg', 450.00, 90, 0),
('P-300', 'UltraClean Dish Detergent', 320.00, 210, 0),
('P-400', 'Herbal Fluoride Toothpaste', 140.00, 320, 0),
('P-500', 'Pure Sunflower Cooking Oil 2L', 520.00, 80, 0),
('P-600', 'Salon Pro Nourishing Shampoo', 280.00, 140, 0);

-- 3 Distributors (Bronze with 5000 credit limit, Silver, Gold)
INSERT INTO distributors (id, name, credit_limit, loyalty_tier) VALUES
('D-101', 'North Point Retail (Bronze)', 5000.00, 'Bronze'),
('D-102', 'Metro Supply Co. (Silver)', 15000.00, 'Silver'),
('D-103', 'Prime Trade Hub (Gold)', 30000.00, 'Gold');

-- 1 Sales Manager
INSERT INTO sales_managers (name, email) VALUES
('Ava Sterling', 'ava.manager@metayb.com');

-- Historical confirmed orders in trailing 90 days to establish Silver (1000-4999 pts) and Gold (5000+ pts)
-- Note: Points per order = floor(total_after_discount / 100).
-- For D-102 (Silver): Order totaling $150,000 across history or $220,000 -> 2,200 points.
-- Example: ORD-HIST-102 with total 220,000 => 2,200 points.
-- For D-103 (Gold): Order totaling $620,000 across history -> 6,200 points.

-- D-102 Silver historical order:
INSERT INTO orders (id, distributor_id, status, subtotal, discount_rate, discount_amount, total, points_awarded, created_at, updated_at) VALUES
('ORD-HIST-102A', 'D-102', 'confirmed', 220000.00, 0.00, 0.00, 220000.00, 2200, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
('ORD-HIST-103A', 'D-103', 'confirmed', 620000.00, 0.03, 18600.00, 601400.00, 6014, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days');

-- Record historical points in ledger (within trailing 90 days)
INSERT INTO loyalty_points_ledger (distributor_id, order_id, points_delta, reason, created_at) VALUES
('D-102', 'ORD-HIST-102A', 2200, 'HISTORICAL_CONFIRMED_ORDER', NOW() - INTERVAL '30 days'),
('D-103', 'ORD-HIST-103A', 6014, 'HISTORICAL_CONFIRMED_ORDER', NOW() - INTERVAL '45 days');

-- Also seed 1 Bronze initial historical order (400 points)
INSERT INTO orders (id, distributor_id, status, subtotal, discount_rate, discount_amount, total, points_awarded, created_at, updated_at) VALUES
('ORD-HIST-101A', 'D-101', 'delivered', 40000.00, 0.00, 0.00, 40000.00, 400, NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days');

INSERT INTO loyalty_points_ledger (distributor_id, order_id, points_delta, reason, created_at) VALUES
('D-101', 'ORD-HIST-101A', 400, 'HISTORICAL_DELIVERED_ORDER', NOW() - INTERVAL '60 days');
