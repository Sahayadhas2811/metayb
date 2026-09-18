import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchProducts,
  fetchDistributors,
  fetchOrders,
  placeOrder,
  transitionOrderStatus,
  resetDatabaseSeed,
} from './services/api';

import Navbar from './components/Navbar';
import DistributorHUD from './components/DistributorHUD';
import ProductCatalogue from './components/ProductCatalogue';
import CartDrawer from './components/CartDrawer';
import OrderHistory from './components/OrderHistory';
import SalesManagerBoard from './components/SalesManagerBoard';
import OrderDetailsModal from './components/OrderDetailsModal';
import FlowchartModal from './components/FlowchartModal';
import Toast from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';

export default function App() {
  // Theme State: 'light' is default
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('metayb_theme') || 'light';
  });

  // Navigation & Role State
  const [activeRole, setActiveRole] = useState('distributor'); // 'distributor' | 'manager'
  const [activeTab, setActiveTab] = useState('catalogue'); // 'catalogue' | 'orders'
  const [selectedDistributorId, setSelectedDistributorId] = useState('D-101');

  // Live Database State
  const [products, setProducts] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);

  // Cart State (sku -> quantity)
  const [cart, setCart] = useState({});

  // Modals & Feedback
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [showFlowchartModal, setShowFlowchartModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Synchronize theme with DOM root and localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('metayb_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev?.id ? null : prev));
    }, 4500);
  }, []);

  // Fetch live dynamic data from database backend
  const loadDatabaseData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodData, distData, ordData] = await Promise.all([
        fetchProducts(),
        fetchDistributors(),
        fetchOrders(),
      ]);

      setProducts(prodData);
      setDistributors(distData);
      setOrders(ordData);

      // Default selected distributor if current not present
      if (distData.length > 0) {
        setSelectedDistributorId((currentId) => {
          const exists = distData.some((d) => d.id === currentId);
          return exists ? currentId : distData[0].id;
        });
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Current active distributor from dynamic DB records
  const currentDistributor = useMemo(() => {
    return (
      distributors.find((d) => d.id === selectedDistributorId) ||
      distributors[0] ||
      null
    );
  }, [distributors, selectedDistributorId]);

  // Dynamic Cart Item Calculations
  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([sku, qty]) => {
        const prod = products.find((p) => p.sku === sku);
        if (!prod || qty <= 0) return null;
        return {
          sku,
          name: prod.name,
          unitPrice: prod.unitPrice,
          quantity: qty,
          available: prod.availableQuantity,
          lineTotal: prod.unitPrice * qty,
        };
      })
      .filter(Boolean);
  }, [cart, products]);

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, i) => acc + i.lineTotal, 0);
  }, [cartItems]);

  const cartDiscountRate = currentDistributor?.discountRate || 0;
  const cartDiscountAmount = Math.round(cartSubtotal * cartDiscountRate * 100) / 100;
  const cartTotal = Math.round((cartSubtotal - cartDiscountAmount) * 100) / 100;
  const cartEstimatedPoints = Math.floor(cartTotal / 100);
  const willExceedCredit = cartTotal > (currentDistributor?.availableCredit || 0);

  // Cart Operations
  const handleAddToCart = (sku, quantity) => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) return;

    const prod = products.find((p) => p.sku === sku);
    if (!prod) return;

    const currentQtyInCart = cart[sku] || 0;
    if (currentQtyInCart + qty > prod.availableQuantity) {
      showToast(
        `Cannot add ${qty} units. Only ${prod.availableQuantity - currentQtyInCart} units remaining in stock.`,
        'error'
      );
      return;
    }

    setCart((prev) => ({
      ...prev,
      [sku]: (prev[sku] || 0) + qty,
    }));

    showToast(`Added ${qty}x ${prod.name} to cart.`);
  };

  const handleUpdateCartQty = (sku, newQty) => {
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) {
      handleRemoveFromCart(sku);
      return;
    }
    const prod = products.find((p) => p.sku === sku);
    if (prod && qty > prod.availableQuantity) {
      showToast(`Requested quantity exceeds available stock (${prod.availableQuantity}).`, 'error');
      return;
    }
    setCart((prev) => ({ ...prev, [sku]: qty }));
  };

  const handleRemoveFromCart = (sku) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[sku];
      return next;
    });
  };

  const handleClearCart = () => setCart({});

  // Place Order (Rule R1, R2, R3, R4)
  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      showToast('Your cart is empty.', 'error');
      return;
    }

    if (!currentDistributor) {
      showToast('No active distributor selected.', 'error');
      return;
    }

    try {
      setPlacingOrder(true);
      const payload = {
        distributorId: currentDistributor.id,
        items: cartItems.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
      };

      const data = await placeOrder(payload);

      showToast(
        data.status === 'confirmed'
          ? `Order ${data.orderId} placed & CONFIRMED! (+${data.pointsAwarded} points awarded)`
          : `Order ${data.orderId} placed. Status: PENDING APPROVAL (Order exceeds available credit limit).`,
        data.status === 'confirmed' ? 'success' : 'error'
      );

      handleClearCart();
      await loadDatabaseData();
      setActiveTab('orders');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPlacingOrder(false);
    }
  };

  // Transition Order Status (Approve, Reject, Dispatch, Deliver, Cancel)
  const handleOrderStatusTransition = async (orderId, targetStatus) => {
    try {
      await transitionOrderStatus({
        orderId,
        targetStatus,
        actorRole: activeRole,
      });

      showToast(`Order ${orderId} moved to "${targetStatus.toUpperCase()}".`);
      await loadDatabaseData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Distributor Order Cancellation Handler
  const handleCancelOrder = (order) => {
    const isConfirmed = order.status === 'confirmed';
    const message = `Cancel order ${order.id}? This will release reserved stock${
      isConfirmed ? ' and reverse awarded loyalty points in the ledger' : ''
    }.`;

    if (window.confirm(message)) {
      handleOrderStatusTransition(order.id, 'cancelled');
    }
  };

  // Reset database seed data
  const handleResetSeed = async () => {
    if (!window.confirm('Reset database to clean seed state (8 products, 3 distributors, historical orders)?')) return;
    try {
      await resetDatabaseSeed();
      showToast('Database reset to clean seed state.');
      handleClearCart();
      await loadDatabaseData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="app-container" data-theme={theme}>
      {/* Top Navigation Bar */}
      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        distributors={distributors}
        selectedDistributorId={selectedDistributorId}
        setSelectedDistributorId={setSelectedDistributorId}
        productsCount={products.length}
        distributorOrdersCount={orders.filter((o) => o.distributorId === currentDistributor?.id).length}
        onOpenFlowchart={() => setShowFlowchartModal(true)}
        onResetSeed={handleResetSeed}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {loading && products.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* DISTRIBUTOR PORTAL */}
            {activeRole === 'distributor' && (
              <>
                {/* Account Head-Up Display (Credit Meter, Loyalty Tier, Points) */}
                <DistributorHUD distributor={currentDistributor} />

                {/* Product Catalogue & Cart Tab */}
                {activeTab === 'catalogue' && (
                  <div className="ordering-layout">
                    <ProductCatalogue
                      products={products}
                      onAddToCart={handleAddToCart}
                    />

                    <CartDrawer
                      cartItems={cartItems}
                      cartSubtotal={cartSubtotal}
                      cartDiscountRate={cartDiscountRate}
                      cartDiscountAmount={cartDiscountAmount}
                      cartTotal={cartTotal}
                      cartEstimatedPoints={cartEstimatedPoints}
                      distributor={currentDistributor}
                      willExceedCredit={willExceedCredit}
                      onUpdateCartQty={handleUpdateCartQty}
                      onRemoveFromCart={handleRemoveFromCart}
                      onClearCart={handleClearCart}
                      onPlaceOrder={handlePlaceOrder}
                      placingOrder={placingOrder}
                    />
                  </div>
                )}

                {/* Distributor Order History Tab */}
                {activeTab === 'orders' && (
                  <OrderHistory
                    distributor={currentDistributor}
                    orders={orders}
                    onSelectOrderDetails={setSelectedOrderDetails}
                    onCancelOrder={handleCancelOrder}
                  />
                )}
              </>
            )}

            {/* SALES MANAGER PORTAL */}
            {activeRole === 'manager' && (
              <SalesManagerBoard
                orders={orders}
                distributors={distributors}
                onSelectOrderDetails={setSelectedOrderDetails}
                onTransitionStatus={handleOrderStatusTransition}
              />
            )}
          </>
        )}
      </main>

      {/* Order Items Breakdown Modal */}
      <OrderDetailsModal
        order={selectedOrderDetails}
        onClose={() => setSelectedOrderDetails(null)}
      />

      {/* State Machine Flowchart Architecture Modal */}
      <FlowchartModal
        isOpen={showFlowchartModal}
        onClose={() => setShowFlowchartModal(false)}
      />

      {/* Floating Feedback Toast */}
      <Toast toast={toast} />
    </div>
  );
}
