# Spice Junction — Restaurant POS System

A production-oriented Restaurant Point-of-Sale system: React + TypeScript + Tailwind
frontend, Node.js + Express + TypeScript backend, PostgreSQL database, real-time
updates via Socket.IO.

This build is **feature-complete against the original 18-module brief**, including
split bill, combo meals, payroll, PDF/CSV export, email/WhatsApp receipt delivery,
live WebSocket updates for KDS/Tables, and barcode scanner support. See
`docs/scope-and-roadmap.md` for implementation notes and what a real production
rollout would add on top (automated tests, code-splitting, multi-outlet UI switching).

## Project layout

```
restaurant-pos/
├── database/
│   ├── schema.sql       # full PostgreSQL schema (all modules, indexes, audit triggers)
│   └── seed.sql         # demo restaurant, users, menu, tables, a completed order
├── backend/             # Node.js + Express + TypeScript REST API
├── frontend/            # React + TypeScript + Tailwind + Redux Toolkit SPA
└── docs/
    ├── api.md           # REST API reference
    └── scope-and-roadmap.md
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

## 1. Database setup

```bash
createdb restaurant_pos
psql "postgresql://postgres:postgres@localhost:5432/restaurant_pos" -f database/schema.sql
psql "postgresql://postgres:postgres@localhost:5432/restaurant_pos" -f database/seed.sql
```

The seed script creates a demo restaurant "Spice Junction" with:

| Role   | Email                          | Password       |
|--------|---------------------------------|----------------|
| Owner  | owner@spicejunction.example      | Password@123   |
| Cashier| cashier@spicejunction.example    | Password@123   |
| Waiter | waiter@spicejunction.example     | Password@123   |

## 2. Backend setup

```bash
cd backend
cp .env.example .env       # edit DATABASE_URL, JWT secrets, CORS_ORIGIN as needed
npm install
npm run dev                # http://localhost:4000
```

`npm run build && npm start` for a production run. Health check: `GET /health`.

## 3. Frontend setup

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173, proxies /api to :4000
```

`npm run build` produces a static `dist/` bundle you can serve from any static host
or behind Nginx/Caddy in front of the API.

## 4. Log in

Open http://localhost:5173, sign in with the owner credentials above. From there:

- **Dashboard** — KPIs, 14-day revenue chart, low-stock alerts, best sellers
- **Billing (POS)** — category/product grid, combo meals, add-on/modifier picker, cart,
  dine-in table selection, discount, **split bill** (divide into N guest shares, each
  settled separately), multi-method checkout, barcode scanner support (type + Enter),
  receipt delivery via Print / Email / WhatsApp
- **Tables** — live floor status with real-time WebSocket updates (tap to cycle
  available → occupied → reserved → cleaning)
- **Kitchen (KDS)** — active tickets with real-time WebSocket updates, advance items
  new → preparing → ready → served
- **Orders** — order history with status
- **Menu** — category tabs, add/edit/delete items, cost & margin at a glance
- **Inventory** — raw material stock levels with low-stock highlighting
- **Customers** — customer list with loyalty points
- **Employees** — staff directory, self attendance check-in/out, and a payroll panel
  (set base salary, one-click "Pay Now" for the month)
- **Expenses** — categories, entries, recurring flag
- **Reports** — sales trend, best sellers, financial summary, payment method split,
  CSV export (opens in Excel), branded PDF export, browser print
- **Settings** — restaurant info, tax/currency defaults, receipt footer, printer IP

### Optional: enable email receipts

Email delivery is off by default (the Email button will show a clear message rather
than fail silently). To enable it, set these in `backend/.env`:

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=no-reply@yourrestaurant.com
```

Any standard SMTP provider works (Gmail SMTP, SendGrid, Amazon SES, Mailgun, etc).
WhatsApp receipts need no configuration — they open a pre-filled `wa.me` link in a
new tab, using the sender's own WhatsApp rather than a paid Business API.

## Security notes for production

- Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` in `.env` — the defaults are for
  local development only.
- Put the API behind HTTPS and set `CORS_ORIGIN` to your real frontend origin.
- The frontend keeps tokens in `sessionStorage` (cleared when the tab closes) rather
  than `localStorage`, and refreshes access tokens silently on 401s.
- Rate limiting is enabled globally and more strictly on `/api/auth/*`.
- All state-changing queries run through parameterized SQL (`pg`); there is no raw
  string interpolation into SQL anywhere in the codebase.
