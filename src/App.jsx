import { useEffect, useMemo, useState } from 'react';
import { initialProducts } from './data/sampleData';

const STORAGE_KEY = 'supermarket-manager-state-v1';
const SESSION_KEY = 'supermarket-manager-session-v1';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

const todayKey = new Date().toISOString().slice(0, 10);

const demoUsers = [
  { username: 'owner', password: 'owner123', name: 'Store Owner', role: 'admin' },
  { username: 'cashier', password: 'cashier123', name: 'Front Cashier', role: 'cashier' },
  { username: 'stock', password: 'stock123', name: 'Inventory Staff', role: 'inventory' }
];

const initialSuppliers = [
  {
    id: 'SUP-1001',
    name: 'FreshFields Produce Co.',
    contact: 'Ava Turner',
    email: 'orders@freshfields.example',
    phone: '+1-555-0112'
  },
  {
    id: 'SUP-1002',
    name: 'Daily Dairy Distributors',
    contact: 'Noah Reed',
    email: 'supply@dailydairy.example',
    phone: '+1-555-0147'
  }
];

const categoryColors = {
  Produce: '#2f8f53',
  Dairy: '#1d7aa8',
  Bakery: '#bb7e1f',
  Pantry: '#7a52a8',
  Meat: '#9f3636',
  Beverages: '#1f8a8a',
  Frozen: '#586a9f'
};

function readPersistedState() {
  try {
    const persisted = localStorage.getItem(STORAGE_KEY);
    if (!persisted) return null;

    const parsed = JSON.parse(persisted);
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.orders)) {
      return null;
    }

    return {
      products: parsed.products,
      orders: parsed.orders,
      suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : initialSuppliers,
      purchaseOrders: Array.isArray(parsed.purchaseOrders) ? parsed.purchaseOrders : []
    };
  } catch {
    return null;
  }
}

function readPersistedSession() {
  try {
    const persisted = localStorage.getItem(SESSION_KEY);
    if (!persisted) return null;

    const parsed = JSON.parse(persisted);
    if (!parsed?.username || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'cashier') return 'Cashier';
  return 'Inventory';
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(escapeCsv).join(',')];
  rows.forEach((row) => {
    lines.push(row.map(escapeCsv).join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildSevenDaySales(orders) {
  const points = [];
  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString(undefined, { weekday: 'short' });
    const total = orders
      .filter((order) => order.date.startsWith(key))
      .reduce((sum, order) => sum + order.total, 0);

    points.push({ key, label, total: Number(total.toFixed(2)) });
  }
  return points;
}

function App() {
  const [initialData] = useState(() => readPersistedState());
  const [products, setProducts] = useState(() => initialData?.products ?? initialProducts);
  const [orders, setOrders] = useState(() => initialData?.orders ?? []);
  const [suppliers, setSuppliers] = useState(() => initialData?.suppliers ?? initialSuppliers);
  const [purchaseOrders, setPurchaseOrders] = useState(() => initialData?.purchaseOrders ?? []);
  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currentUser, setCurrentUser] = useState(() => readPersistedSession());
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: 'Produce',
    price: '',
    stock: ''
  });
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact: '',
    email: '',
    phone: ''
  });
  const [poForm, setPoForm] = useState({
    supplierId: '',
    productId: '',
    quantity: '',
    unitCost: ''
  });

  const canManageInventory = currentUser?.role === 'admin' || currentUser?.role === 'inventory';
  const canCheckout = currentUser?.role === 'admin' || currentUser?.role === 'cashier';
  const canManageSuppliers = currentUser?.role === 'admin' || currentUser?.role === 'inventory';

  const tabs = useMemo(() => {
    if (!currentUser) return [];

    const next = [
      ['dashboard', 'Dashboard'],
      ['reports', 'Reports']
    ];

    if (canManageInventory) next.push(['inventory', 'Inventory']);
    if (canCheckout) next.push(['checkout', 'Checkout']);
    next.push(['orders', 'Orders']);
    if (canManageSuppliers) next.push(['suppliers', 'Suppliers']);
    return next;
  }, [canCheckout, canManageInventory, canManageSuppliers, currentUser]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        products,
        orders,
        suppliers,
        purchaseOrders
      })
    );
  }, [products, orders, suppliers, purchaseOrders]);

  useEffect(() => {
    if (!currentUser) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some(([key]) => key === activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, tabs]);

  const categories = useMemo(() => {
    const all = new Set(products.map((item) => item.category));
    return ['All', ...all];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const byText = item.name.toLowerCase().includes(search.toLowerCase());
      const byCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return byText && byCategory;
    });
  }, [products, search, categoryFilter]);

  const lowStockProducts = useMemo(() => {
    return products.filter((item) => item.stock <= 10);
  }, [products]);

  const dashboard = useMemo(() => {
    const inventoryValue = products.reduce((sum, item) => sum + item.price * item.stock, 0);
    const todaysOrders = orders.filter((order) => order.date.startsWith(todayKey));
    const todaysSales = todaysOrders.reduce((sum, order) => sum + order.total, 0);
    const pendingPOs = purchaseOrders.filter((po) => po.status === 'Pending').length;

    return {
      inventoryValue,
      lowStockItems: lowStockProducts.length,
      totalProducts: products.length,
      todaysSales,
      todaysOrders: todaysOrders.length,
      suppliers: suppliers.length,
      pendingPOs
    };
  }, [orders, products, purchaseOrders, suppliers, lowStockProducts.length]);

  const suppliersById = useMemo(() => {
    return suppliers.reduce((acc, supplier) => {
      acc[supplier.id] = supplier;
      return acc;
    }, {});
  }, [suppliers]);

  const productsById = useMemo(() => {
    return products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {});
  }, [products]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [cart]
  );

  const salesByCategory = useMemo(() => {
    const map = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const product = productsById[item.productId];
        const category = product?.category || 'Unknown';
        map[category] = (map[category] || 0) + item.quantity * item.unitPrice;
      });
    });

    return Object.entries(map)
      .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total);
  }, [orders, productsById]);

  const topProducts = useMemo(() => {
    const map = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!map[item.productId]) {
          map[item.productId] = {
            name: item.name,
            quantity: 0,
            revenue: 0
          };
        }

        map[item.productId].quantity += item.quantity;
        map[item.productId].revenue += item.quantity * item.unitPrice;
      });
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        revenue: Number(item.revenue.toFixed(2))
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [orders]);

  const weeklySales = useMemo(() => buildSevenDaySales(orders), [orders]);
  const maxWeeklySales = Math.max(...weeklySales.map((item) => item.total), 1);

  const handleLogin = (event) => {
    event.preventDefault();

    const match = demoUsers.find(
      (user) =>
        user.username === loginForm.username.trim().toLowerCase() &&
        user.password === loginForm.password
    );

    if (!match) {
      setLoginError('Invalid username or password.');
      return;
    }

    setCurrentUser({ username: match.username, name: match.name, role: match.role });
    setLoginForm({ username: '', password: '' });
    setLoginError('');
  };

  const logout = () => {
    setCurrentUser(null);
    setCart([]);
    setActiveTab('dashboard');
  };

  const addProduct = (event) => {
    event.preventDefault();
    if (!canManageInventory) return;

    const name = formData.name.trim();
    const price = Number(formData.price);
    const stock = Number(formData.stock);

    if (!name || Number.isNaN(price) || Number.isNaN(stock) || price <= 0 || stock < 0) {
      return;
    }

    setProducts((prev) => [
      {
        id: Date.now(),
        name,
        category: formData.category,
        price,
        stock
      },
      ...prev
    ]);

    setFormData({
      name: '',
      category: 'Produce',
      price: '',
      stock: ''
    });
  };

  const restockProduct = (id, amount) => {
    if (!canManageInventory) return;

    const quantity = Number(amount);
    if (Number.isNaN(quantity) || quantity === 0) return;

    setProducts((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              stock: Math.max(0, item.stock + quantity)
            }
          : item
      )
    );
  };

  const addToCart = (product) => {
    if (!canCheckout || product.stock <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: 1
        }
      ];
    });
  };

  const updateCartQuantity = (productId, quantity) => {
    if (!canCheckout) return;

    const value = Number(quantity);
    if (Number.isNaN(value)) return;

    const product = products.find((item) => item.id === productId);
    if (!product) return;

    if (value <= 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }

    const next = Math.min(value, product.stock);
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: next } : item))
    );
  };

  const checkout = () => {
    if (!canCheckout || !cart.length) return;

    const isInvalid = cart.some((cartItem) => {
      const product = products.find((item) => item.id === cartItem.productId);
      return !product || cartItem.quantity > product.stock;
    });

    if (isInvalid) return;

    setProducts((prev) =>
      prev.map((product) => {
        const cartItem = cart.find((item) => item.productId === product.id);
        if (!cartItem) return product;

        return {
          ...product,
          stock: product.stock - cartItem.quantity
        };
      })
    );

    const newOrder = {
      id: `ORD-${Date.now()}`,
      date: new Date().toISOString(),
      total: Number(cartTotal.toFixed(2)),
      cashier: currentUser?.username ?? 'system',
      items: cart
    };

    setOrders((prev) => [newOrder, ...prev]);
    setCart([]);
    setActiveTab('orders');
  };

  const addSupplier = (event) => {
    event.preventDefault();
    if (!canManageSuppliers) return;

    const name = supplierForm.name.trim();
    if (!name) return;

    setSuppliers((prev) => [
      {
        id: createId('SUP'),
        name,
        contact: supplierForm.contact.trim(),
        email: supplierForm.email.trim(),
        phone: supplierForm.phone.trim()
      },
      ...prev
    ]);

    setSupplierForm({
      name: '',
      contact: '',
      email: '',
      phone: ''
    });
  };

  const createPurchaseOrder = (event) => {
    event.preventDefault();
    if (!canManageSuppliers) return;

    const quantity = Number(poForm.quantity);
    const unitCost = Number(poForm.unitCost);

    if (!poForm.supplierId || !poForm.productId || Number.isNaN(quantity) || quantity <= 0) {
      return;
    }

    const cleanUnitCost = Number.isNaN(unitCost) || unitCost < 0 ? 0 : unitCost;

    setPurchaseOrders((prev) => [
      {
        id: createId('PO'),
        supplierId: poForm.supplierId,
        productId: Number(poForm.productId),
        quantity,
        unitCost: cleanUnitCost,
        status: 'Pending',
        source: 'manual',
        createdAt: new Date().toISOString(),
        receivedAt: null,
        createdBy: currentUser?.username ?? 'system'
      },
      ...prev
    ]);

    setPoForm({
      supplierId: '',
      productId: '',
      quantity: '',
      unitCost: ''
    });
  };

  const receivePurchaseOrder = (purchaseOrderId) => {
    if (!canManageSuppliers) return;

    const target = purchaseOrders.find((po) => po.id === purchaseOrderId);
    if (!target || target.status !== 'Pending') return;

    setProducts((prev) =>
      prev.map((product) =>
        product.id === target.productId
          ? {
              ...product,
              stock: product.stock + target.quantity
            }
          : product
      )
    );

    setPurchaseOrders((prev) =>
      prev.map((po) =>
        po.id === purchaseOrderId
          ? {
              ...po,
              status: 'Received',
              receivedAt: new Date().toISOString()
            }
          : po
      )
    );
  };

  const suggestPurchaseOrders = () => {
    if (!canManageSuppliers || suppliers.length === 0) return;

    const pendingByProduct = new Set(
      purchaseOrders
        .filter((po) => po.status === 'Pending')
        .map((po) => Number(po.productId))
    );

    const suggestions = lowStockProducts
      .filter((product) => !pendingByProduct.has(Number(product.id)))
      .map((product) => ({
        id: createId('PO'),
        supplierId: suppliers[0].id,
        productId: product.id,
        quantity: Math.max(12, 30 - product.stock),
        unitCost: Number((product.price * 0.62).toFixed(2)),
        status: 'Pending',
        source: 'auto-suggested',
        createdAt: new Date().toISOString(),
        receivedAt: null,
        createdBy: currentUser?.username ?? 'system'
      }));

    if (!suggestions.length) return;
    setPurchaseOrders((prev) => [...suggestions, ...prev]);
    setActiveTab('suppliers');
  };

  const exportInventoryCsv = () => {
    const rows = products.map((product) => [
      product.id,
      product.name,
      product.category,
      product.price,
      product.stock,
      Number((product.price * product.stock).toFixed(2))
    ]);

    downloadCsv('inventory.csv', ['id', 'name', 'category', 'price', 'stock', 'stock_value'], rows);
  };

  const exportOrdersCsv = () => {
    const rows = orders.flatMap((order) =>
      order.items.map((item) => [
        order.id,
        order.date,
        order.cashier ?? '',
        item.name,
        item.quantity,
        item.unitPrice,
        Number((item.quantity * item.unitPrice).toFixed(2)),
        order.total
      ])
    );

    downloadCsv(
      'orders.csv',
      ['order_id', 'date', 'cashier', 'product', 'quantity', 'unit_price', 'line_total', 'order_total'],
      rows
    );
  };

  const exportPurchaseOrdersCsv = () => {
    const rows = purchaseOrders.map((po) => [
      po.id,
      suppliersById[po.supplierId]?.name ?? po.supplierId,
      productsById[po.productId]?.name ?? po.productId,
      po.quantity,
      po.unitCost,
      Number((po.quantity * po.unitCost).toFixed(2)),
      po.status,
      po.source,
      po.createdAt,
      po.receivedAt ?? '',
      po.createdBy ?? ''
    ]);

    downloadCsv(
      'purchase-orders.csv',
      [
        'po_id',
        'supplier',
        'product',
        'quantity',
        'unit_cost',
        'total_cost',
        'status',
        'source',
        'created_at',
        'received_at',
        'created_by'
      ],
      rows
    );
  };

  if (!currentUser) {
    return (
      <div className="login-shell">
        <section className="login-card">
          <p className="tag">Store Access</p>
          <h1>Supermarket Manager</h1>
          <p className="sub">Sign in with your staff account to continue.</p>

          <form className="form" onSubmit={handleLogin}>
            <label>
              Username
              <input
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="owner"
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="owner123"
                autoComplete="current-password"
              />
            </label>
            {loginError && <p className="error-text">{loginError}</p>}
            <button type="submit">Sign In</button>
          </form>

          <div className="hint-box muted">
            <strong>Demo logins:</strong>
            <p>
              <code>owner / owner123</code> (admin)
            </p>
            <p>
              <code>cashier / cashier123</code> (checkout + orders)
            </p>
            <p>
              <code>stock / stock123</code> (inventory + suppliers)
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="tag">Store Intelligence</p>
          <h1>Supermarket Manager</h1>
          <p className="sub">
            Manage inventory, process checkout, monitor reports, and automate low-stock purchasing.
          </p>
        </div>
        <div className="hero-stats">
          <span>Today&apos;s Sales</span>
          <strong>{currency.format(dashboard.todaysSales)}</strong>
          <p className="user-chip">
            {currentUser.name} · {roleLabel(currentUser.role)}
          </p>
          <button className="ghost-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={activeTab === key ? 'active' : ''}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'dashboard' && (
        <>
          <section className="grid stats-grid">
            <MetricCard label="Inventory Value" value={currency.format(dashboard.inventoryValue)} />
            <MetricCard label="Total Products" value={dashboard.totalProducts} />
            <MetricCard label="Low-Stock Items" value={dashboard.lowStockItems} />
            <MetricCard label="Today Orders" value={dashboard.todaysOrders} />
            <MetricCard label="Suppliers" value={dashboard.suppliers} />
            <MetricCard label="Pending POs" value={dashboard.pendingPOs} />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Low-Stock Alerts</h2>
              <button
                className="secondary-btn"
                onClick={suggestPurchaseOrders}
                disabled={!canManageSuppliers || !lowStockProducts.length || !suppliers.length}
              >
                Auto Suggest POs
              </button>
            </div>

            {!lowStockProducts.length && <p className="muted">No low-stock alerts right now.</p>}

            {!!lowStockProducts.length && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Current Stock</th>
                      <th>Suggested Reorder Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockProducts.map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.category}</td>
                        <td className="low">{product.stock}</td>
                        <td>{Math.max(12, 30 - product.stock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'reports' && (
        <section className="grid reports-grid">
          <div className="panel">
            <div className="panel-head">
              <h2>7-Day Sales Trend</h2>
            </div>
            <div className="bars-wrap">
              {weeklySales.map((point) => (
                <div key={point.key} className="bar-col" title={`${point.label}: ${currency.format(point.total)}`}>
                  <div
                    className="bar"
                    style={{
                      height: `${Math.max((point.total / maxWeeklySales) * 100, point.total > 0 ? 8 : 2)}%`
                    }}
                  />
                  <span>{point.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Sales by Category</h2>
            {!salesByCategory.length && <p className="muted">No sales data yet.</p>}
            <div className="category-list">
              {salesByCategory.map((entry) => (
                <div key={entry.category} className="category-row">
                  <div className="category-name">
                    <span
                      className="dot"
                      style={{ background: categoryColors[entry.category] || '#64748b' }}
                    />
                    <span>{entry.category}</span>
                  </div>
                  <strong>{currency.format(entry.total)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Top Products</h2>
            {!topProducts.length && <p className="muted">No sales data yet.</p>}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{currency.format(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'inventory' && canManageInventory && (
        <section className="grid inventory-grid">
          <div className="panel">
            <h2>Add Product</h2>
            <form className="form" onSubmit={addProduct}>
              <label>
                Product Name
                <input
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="e.g. Greek Yogurt"
                />
              </label>
              <label>
                Category
                <select
                  value={formData.category}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, category: event.target.value }))
                  }
                >
                  {['Produce', 'Dairy', 'Bakery', 'Pantry', 'Meat', 'Beverages', 'Frozen'].map(
                    (category) => (
                      <option key={category}>{category}</option>
                    )
                  )}
                </select>
              </label>
              <label>
                Price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, price: event.target.value }))
                  }
                  placeholder="0.00"
                />
              </label>
              <label>
                Stock
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, stock: event.target.value }))
                  }
                  placeholder="0"
                />
              </label>
              <button type="submit">Add Product</button>
            </form>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Inventory</h2>
              <button className="secondary-btn" onClick={exportInventoryCsv}>
                Export CSV
              </button>
            </div>

            <div className="filters">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products"
              />
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Adjust</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.category}</td>
                      <td>{currency.format(item.price)}</td>
                      <td className={item.stock <= 10 ? 'low' : ''}>{item.stock}</td>
                      <td>
                        <div className="stock-actions">
                          <button onClick={() => restockProduct(item.id, 1)}>+1</button>
                          <button onClick={() => restockProduct(item.id, -1)}>-1</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'checkout' && canCheckout && (
        <section className="grid checkout-grid">
          <div className="panel">
            <h2>Products</h2>
            <div className="product-list">
              {products.map((item) => (
                <button
                  key={item.id}
                  className="product-card"
                  disabled={item.stock === 0}
                  onClick={() => addToCart(item)}
                >
                  <span>{item.name}</span>
                  <small>
                    {currency.format(item.price)} • Stock {item.stock}
                  </small>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Cart</h2>
            {!cart.length && <p className="muted">No items in cart.</p>}
            {cart.length > 0 && (
              <div className="cart-list">
                {cart.map((item) => (
                  <div key={item.productId} className="cart-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{currency.format(item.unitPrice)}</p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(event) => updateCartQuantity(item.productId, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="checkout-footer">
              <div>
                <span>Total</span>
                <strong>{currency.format(cartTotal)}</strong>
              </div>
              <button onClick={checkout} disabled={!cart.length}>
                Complete Sale
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'orders' && (
        <section className="panel">
          <div className="panel-head">
            <h2>Recent Orders</h2>
            <button className="secondary-btn" onClick={exportOrdersCsv} disabled={!orders.length}>
              Export CSV
            </button>
          </div>

          {!orders.length && <p className="muted">No orders yet.</p>}
          <div className="orders-list">
            {orders.map((order) => (
              <article key={order.id}>
                <header>
                  <div>
                    <h3>{order.id}</h3>
                    <p>
                      {new Date(order.date).toLocaleString()} · by {order.cashier ?? 'system'}
                    </p>
                  </div>
                  <strong>{currency.format(order.total)}</strong>
                </header>
                <ul>
                  {order.items.map((item) => (
                    <li key={`${order.id}-${item.productId}`}>
                      {item.name} × {item.quantity}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'suppliers' && canManageSuppliers && (
        <section className="grid supplier-grid">
          <div className="panel">
            <h2>Add Supplier</h2>
            <form className="form" onSubmit={addSupplier}>
              <label>
                Supplier Name
                <input
                  value={supplierForm.name}
                  onChange={(event) =>
                    setSupplierForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Supplier name"
                />
              </label>
              <label>
                Contact Person
                <input
                  value={supplierForm.contact}
                  onChange={(event) =>
                    setSupplierForm((prev) => ({ ...prev, contact: event.target.value }))
                  }
                  placeholder="Contact person"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={supplierForm.email}
                  onChange={(event) =>
                    setSupplierForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="name@example.com"
                />
              </label>
              <label>
                Phone
                <input
                  value={supplierForm.phone}
                  onChange={(event) =>
                    setSupplierForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="+1-555-0100"
                />
              </label>
              <button type="submit">Add Supplier</button>
            </form>

            <div className="table-wrap mt-12">
              <table>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Contact</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>{supplier.name}</td>
                      <td>{supplier.contact || supplier.phone || '-'}</td>
                      <td>{supplier.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Purchase Orders</h2>
              <div className="inline-actions">
                <button
                  className="secondary-btn"
                  onClick={suggestPurchaseOrders}
                  disabled={!lowStockProducts.length || !suppliers.length}
                >
                  Suggest POs
                </button>
                <button
                  className="secondary-btn"
                  onClick={exportPurchaseOrdersCsv}
                  disabled={!purchaseOrders.length}
                >
                  Export CSV
                </button>
              </div>
            </div>

            <form className="form" onSubmit={createPurchaseOrder}>
              <label>
                Supplier
                <select
                  value={poForm.supplierId}
                  onChange={(event) =>
                    setPoForm((prev) => ({ ...prev, supplierId: event.target.value }))
                  }
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Product
                <select
                  value={poForm.productId}
                  onChange={(event) =>
                    setPoForm((prev) => ({ ...prev, productId: event.target.value }))
                  }
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  value={poForm.quantity}
                  onChange={(event) =>
                    setPoForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                  placeholder="0"
                />
              </label>

              <label>
                Unit Cost
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={poForm.unitCost}
                  onChange={(event) =>
                    setPoForm((prev) => ({ ...prev, unitCost: event.target.value }))
                  }
                  placeholder="0.00"
                />
              </label>

              <button type="submit">Create PO</button>
            </form>

            <div className="orders-list mt-12">
              {!purchaseOrders.length && <p className="muted">No purchase orders yet.</p>}
              {purchaseOrders.map((po) => (
                <article key={po.id}>
                  <header>
                    <div>
                      <h3>{po.id}</h3>
                      <p>
                        {suppliersById[po.supplierId]?.name ?? 'Unknown Supplier'} ·{' '}
                        {new Date(po.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <strong>{po.status}</strong>
                  </header>
                  <ul>
                    <li>Product: {productsById[po.productId]?.name ?? 'Unknown Product'}</li>
                    <li>Quantity: {po.quantity}</li>
                    <li>Total Cost: {currency.format(po.quantity * po.unitCost)}</li>
                    <li>Source: {po.source}</li>
                  </ul>
                  {po.status === 'Pending' && (
                    <button className="mt-12" onClick={() => receivePurchaseOrder(po.id)}>
                      Mark Received (+Stock)
                    </button>
                  )}
                  {po.status === 'Received' && po.receivedAt && (
                    <p className="muted">Received at {new Date(po.receivedAt).toLocaleString()}</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

export default App;
