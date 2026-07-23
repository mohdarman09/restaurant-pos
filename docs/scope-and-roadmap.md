# Scope & Roadmap

The original brief asked for all 18 modules of a full commercial POS suite. This
document tracks what's built. As of this update, every item from the original
roadmap has a working implementation end-to-end (backend + frontend + DB).

## Fully wired (API + UI + DB)

- Authentication: login, refresh tokens, change/forgot/reset password, login history
- Role-based access control (super_admin / owner / manager / cashier / waiter / kitchen_staff)
- Dashboard KPIs + revenue trend chart + low-stock + best-sellers
- Menu management: categories, products, CRUD, cost/margin display
- POS billing: cart, dine-in/take-away/delivery, table selection, % discount, coupon
  codes, add-ons/modifiers picker (single- and multi-select groups), **combo meals**
  (tap a combo tile, price is apportioned across its constituent products so
  inventory deduction still works per-ingredient), multi-method checkout, automatic
  raw-material stock deduction on sale
- **Split bill**: split a pending order into N guest shares (defaults to equal split,
  adjustable guest count), each share settled independently with its own payment
  method; the order auto-completes once every share is paid
- Table management: live status board, transfer, merge, reservations — now with
  **real-time WebSocket push** (Socket.IO) so every open POS/Tables/KDS screen
  updates instantly when another device changes something, with a slower polling
  fallback in case the socket drops
- Kitchen Display System: tickets, per-item status progression, priority flag,
  live push as above
- Inventory: raw materials, stock movements ledger, suppliers, purchase orders + GRN
- Reporting: sales trend, order status breakdown, best/slow products, inventory,
  financial summary with payment-method split, top customers, employee sales —
  with **CSV export** (opens in Excel), **branded PDF export** (via pdfkit, with
  the restaurant's name in the header), and browser print
- Customer directory with loyalty points
- Settings screen: restaurant info, tax/currency defaults, receipt footer, printer IP
- Expenses module: categories, entries, recurring flag, running total
- Employee module: staff directory, self attendance check-in/out, attendance log
- **Payroll**: set/update each employee's base salary, one-click "Pay Now" for the
  current month, paid/pending status per employee
- Notifications: real dropdown in the topbar with unread badge, mark-all-read
- **Receipt delivery**: Print (opens a formatted receipt in a print-ready popup),
  Email (via SMTP/nodemailer — configure `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` in
  the backend `.env`; shows a clear message if not configured rather than failing
  silently), WhatsApp (generates a pre-filled `wa.me` share link — no paid WhatsApp
  Business API key needed, opens the cashier's or customer's own WhatsApp)
- **Barcode scanning**: exact-match lookup endpoint; a hardware scanner "typing" a
  code into the POS search box and sending Enter adds the matched product straight
  to the cart

## Notes on implementation choices

- **Combo pricing**: rather than adding a parallel "combo order item" concept to
  the schema, a combo is expanded into its constituent `order_items` at order-creation
  time, with the combo's flat price apportioned pro-rata by each constituent's own
  base price. This keeps per-ingredient inventory deduction, KDS tickets, and
  reporting all working unmodified — a combo just looks like "the right products,
  correctly priced" everywhere downstream.
- **Split bill payments**: each guest's share is recorded as its own `order_payments`
  row when they pay, so the financial/payment-method reports don't need special-casing.
- **PDF export** uses `pdfkit` (pure Node, no external binary/Chromium dependency),
  which keeps the backend lightweight and deployable anywhere Node runs.
- **WhatsApp delivery** deliberately avoids requiring a paid WhatsApp Business API
  key — the `wa.me` deep-link approach is what most independent restaurants actually
  use in practice, and upgrading to the official Business API later is a drop-in
  replacement of one function in `receipt.controller.ts`.
- **WebSocket auth** reuses the existing JWT access token (sent once over the socket
  after connecting) rather than introducing a second auth mechanism, and joins an
  `outlet:<id>` room so updates never leak across outlets/restaurants.

## If you want to go further

The system is now feature-complete against the original brief. Natural next steps
for a real production rollout, roughly in order of impact:

1. Swap the CSV/simple-PDF reports for a proper templating pipeline if you need
   pixel-perfect branded PDFs (logo images, custom fonts) beyond what pdfkit's
   programmatic drawing gives you
2. Upgrade WhatsApp delivery to the official Business API if you need delivery
   receipts/read receipts or are sending at high volume
3. Add code-splitting to the frontend build (currently one ~750KB JS bundle) if
   initial load time matters at your scale
4. Multi-outlet switching in the UI (the schema already supports multiple outlets
   per restaurant; the frontend currently assumes one outlet per logged-in user)
5. Automated tests (unit tests for the pricing/discount/split-bill math, integration
   tests for the checkout flow) before taking this to production
