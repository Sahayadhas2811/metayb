# MetaYB Supply | B2B Consumer Goods Manufacturer Portal

A web application through which a consumer goods manufacturer takes orders from distributors, tracks warehouse stock with strict transactional reservations, and operates a dynamic points-based loyalty programme.

---

## Steps to Run the Full Application Locally (Max 5 Commands)

Follow these concise steps to run the database setup, backend API, and frontend client:

```bash
# Command 1: Install backend dependencies
cd backend && npm install

# Command 2: Create PostgreSQL schema and seed data (8 products, 3 distributors, 1 manager)
npm run setup-db

# Command 3: Start backend server (runs at http://localhost:5000)
npm start &

# Command 4: Install frontend dependencies
cd ../frontend && npm install

# Command 5: Start frontend development server (runs at http://localhost:5173)
npm run dev
```

*Note: You can also verify the entire business rule and state transition suite with a single command:*
```bash
cd backend && npm run test-e2e
```

---

## System Architecture & Actors

The system serves three primary actors:
1. **Distributor**:
   - Browses catalog with live warehouse stock (`stock_quantity - reserved_quantity`).
   - Views credit limit, active exposure, and real-time available credit.
   - Views current loyalty tier (Bronze, Silver, Gold) and locked discount rate.
   - Builds multi-line-item cart with live discount & points preview.
   - Places orders and tracks status transitions in order history.
   - Cancels orders prior to dispatch (releasing reserved stock and reversing awarded points).
2. **Sales Manager**:
   - Accesses pending approval queue for orders where total exceeded available credit.
   - Evaluates distributor credit exposure and approves or rejects orders.
   - Manages warehouse fulfillment by dispatching confirmed orders.
3. **System (State Machine & Automation)**:
   - Enforces transactional stock reservations (R1).
   - Enforces State Diagram v2 order status transitions (B3).
   - Validates available credit dynamically (R3).
   - Credits loyalty points exclusively on entering `confirmed` (R4).
   - Reverses points and recalculates tiers dynamically on cancellation (R5).

---

## Business Rules & Invariants Implemented

| Rule | Implementation Details |
| :--- | :--- |
| **R1: Stock Reservation** | Stock is reserved when an order is placed (`reserved_quantity += requested`). Stock is permanently deducted when dispatched (`stock_quantity -= requested`, `reserved_quantity -= requested`). Cancellation or rejection before dispatch releases reservation exactly once (`reserved_quantity -= requested`). Insufficient stock rejects order with exact SKU and available count. |
| **R2: Fixed Tier Discount** | Discount percentage is fixed at placement based on the distributor's tier at that moment (Bronze: 0%, Silver: 3%, Gold: 6%). Subsequent tier changes do not alter an existing order's total. |
| **R3: Available Credit Check** | $\text{Available Credit} = \text{Credit Limit} - \sum \text{Total of orders NOT in } (\text{'delivered'}, \text{'cancelled'}, \text{'rejected'})$. Total $\le$ available credit $\to$ `confirmed`. Total $>$ available credit $\to$ `pendingApproval`. |
| **B2 & R4: Loyalty Points** | Points earned = $\lfloor \text{Order Total After Discount} / 100 \rfloor$. Points awarded *only* on entering `confirmed`. Orders that never reach `confirmed` award no points. |
| **R5: Point Reversal & Tier Recalculation** | Cancelling a `confirmed` order reverses its awarded points in `loyalty_points_ledger`. Distributor tier is recalculated immediately across trailing 90 days ($< 1000$: Bronze, $1000 - 4999$: Silver, $\ge 5000$: Gold). |
| **B3: State Transitions** | Allowed transitions: `placed` $\to$ `confirmed` / `pendingApproval` / `cancelled`; `pendingApproval` $\to$ `confirmed` / `rejected` / `cancelled`; `confirmed` $\to$ `dispatched` / `cancelled`; `dispatched` $\to$ `delivered`. Disallowed transitions return HTTP 400. |
| **B5: Seed Data** | 8 products (including `P-101` with stock 0 and `P-102` with stock 1); 3 distributors (Bronze limit $5000, Silver, Gold with historical trailing 90-day orders); 1 sales manager (`Ava Sterling`). |

---

## Database Design & Artifacts

- **Database Markup Language**: [schema.dbml](file:///d:/Study/metayb/new-1/schema.dbml)
- **Engineering Notes (400-800 words)**: [notes.md](file:///d:/Study/metayb/new-1/notes.md)
- **PostgreSQL DDL**: [backend/sql/schema.sql](file:///d:/Study/metayb/new-1/backend/sql/schema.sql)
- **Seed Data**: [backend/sql/seed.sql](file:///d:/Study/metayb/new-1/backend/sql/seed.sql)

---

## API Endpoints Reference

- `GET /api/health` - Database connectivity & system health check
- `GET /api/products` - Product catalogue with SKU, name, unit price, and available stock
- `GET /api/distributors` - Distributor accounts with credit limits, exposure, points, and tiers
- `GET /api/orders` - Order history with line items and status
- `POST /api/orders` - Place order with atomic stock reservation and credit verification
- `PATCH /api/orders/:id/status` - Transition order status (`confirmed`, `rejected`, `dispatched`, `delivered`, `cancelled`)
- `POST /api/reset-seed` - Reset database to clean initial seed data for interactive testing
