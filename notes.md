# Engineering Notes: B2B Ordering, Stock Reservation, and Loyalty System

## 1. Architecture and Component Design

The platform uses a decoupled three-tier architecture comprising a PostgreSQL 17 relational database, a Node.js/Express transaction processing backend, and a modern React 19 single-page application. The system serves three principal actors: Distributors, Sales Managers, and Automated Background System Workers. 

The backend architecture is layered into HTTP route controllers, business logic domain services, and database access pools. The database employs strict ACID transaction semantics using row-level locking (`SELECT ... FOR UPDATE`) to prevent inventory overselling and race conditions during simultaneous order placement. An append-only audit ledger (`loyalty_points_ledger`) decouples point transaction logging from point balance aggregations, ensuring mathematical auditability. Communication between the frontend and backend is RESTful, carrying strongly validated JSON payloads with descriptive domain error codes (`INSUFFICIENT_STOCK`, `DISALLOWED_TRANSITION`).

## 2. Stock Reservation and Concurrency Management (R1)

Inventory is tracked for a single central warehouse via two integer counters on the `products` table: `stock_quantity` (physical on-hand inventory) and `reserved_quantity` (stock allocated to active orders). The true available stock is calculated dynamically as `stock_quantity - reserved_quantity`.

When an order is placed, an atomic database transaction evaluates all requested items against available stock. If any line item cannot be fulfilled in its entirety, the transaction aborts and returns an HTTP 400 payload identifying the offending SKU and exact available quantity. If stock is sufficient, the system increments `reserved_quantity` by the ordered amount. 

Stock remains reserved across `placed`, `pendingApproval`, and `confirmed` states. Physical stock deduction occurs exclusively when an order reaches `dispatched`, at which point `stock_quantity` is decremented and `reserved_quantity` is cleared. If an order is rejected or cancelled prior to dispatch, `reserved_quantity` is decremented exactly once, restoring available stock immediately without altering physical on-hand inventory.

## 3. Credit Limit Check and Order State Transitions (R3, B3)

Distributor orders are governed by a deterministic finite state machine (State Diagram v2). Disallowed status transitions are intercepted server-side and rejected without modifying the persistent entity.

Available credit is computed on-demand per rule R3:
$$\text{Available Credit} = \text{Credit Limit} - \sum \text{Total of orders NOT in ('delivered', 'cancelled', 'rejected')}$$

When an order is submitted:
1. If the calculated order total is less than or equal to the distributor's available credit, the order transitions directly to `confirmed`.
2. If the total exceeds available credit, the order transitions to `pendingApproval`, requiring explicit Sales Manager intervention.

Sales Managers review credit-exceeded orders through a dedicated queue. Approving an order transitions it to `confirmed`, whereas rejecting it transitions it to `rejected` and releases the reserved stock. Cancellation is supported from `placed`, `pendingApproval`, and `confirmed` states.

## 4. Loyalty Points Calculation and Tier Dynamics (B2, R2, R4, R5)

The loyalty program categorizes distributors into three tiers based on cumulative points earned in the trailing 90 days:
- **Bronze** (0–999 points): 0% discount
- **Silver** (1,000–4,999 points): 3% discount
- **Gold** ($\ge$ 5,000 points): 6% discount

Per rule R2, an order's discount percentage is permanently locked at the time of order creation based on the distributor's active tier; subsequent tier changes do not modify existing orders. Points are computed as $\lfloor \text{Total After Discount} / 100 \rfloor$ and are awarded solely when an order enters `confirmed` (R4). Orders rejected or cancelled before confirmation generate zero points.

When a `confirmed` order is cancelled, rule R5 mandates the immediate reversal of awarded points via a negative ledger entry. Following any points alteration, the distributor's trailing 90-day points balance is re-aggregated, and their `loyalty_tier` is recalculated and stored, guaranteeing that subsequent orders immediately reflect updated tier discounts.

## 5. Edge Cases, Failure Modes, and Extensibility

The system actively guards against several failure modes:
- **Zero and Edge Stock Constraints**: Catalog items with zero available stock cannot be ordered, and single-unit items cannot be double-booked under concurrent requests due to row-level locks.
- **Credit Race Conditions**: Re-evaluating available credit within the order placement transaction prevents distributors from bypassing limits with concurrent checkout requests.
- **Multi-Warehouse Extensibility**: The inventory model is structured to scale cleanly to multi-warehouse topologies by introducing a `warehouse_inventory` junction table without altering the higher-level order state machine.
