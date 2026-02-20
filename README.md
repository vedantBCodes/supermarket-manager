# Supermarket Manager (React)

A React app for supermarket operations with:

- Role-based login (frontend only: admin, cashier, inventory staff)
- Inventory management (add products, stock adjustments, search/filter)
- Checkout flow (cart + complete sale)
- Orders history
- Supplier management + purchase order tracking
- Low-stock alerts with one-click auto PO suggestions
- Reports dashboard (7-day sales trend, category sales, top products)
- CSV exports for inventory, orders, and purchase orders
- Local persistence using browser `localStorage`

## Demo login credentials

- `owner / owner123` (admin)
- `cashier / cashier123` (checkout + orders)
- `stock / stock123` (inventory + suppliers)

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Build for production (for GitHub Pages deploy):

```bash
npm run build
```
