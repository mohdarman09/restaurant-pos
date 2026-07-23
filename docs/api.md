# API Reference

Base URL: `http://localhost:4000/api`

All endpoints except `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, and
`/auth/reset-password` require an `Authorization: Bearer <accessToken>` header.

Standard response envelope:
```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "...", "details": { ... } }
```
Paginated list endpoints add:
```json
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }
```

## Auth — `/auth`

| Method | Path                | Body                                   | Notes |
|--------|---------------------|-----------------------------------------|-------|
| POST   | /login               | `{ email, password }`                  | Returns `accessToken`, `refreshToken`, `user` |
| POST   | /refresh             | `{ refreshToken }`                     | Returns a new `accessToken` |
| POST   | /logout              | `{ refreshToken }`                     | Revokes the refresh token |
| POST   | /change-password     | `{ currentPassword, newPassword }`     | Auth required |
| POST   | /forgot-password      | `{ email }`                             | Always returns success (no user enumeration) |
| POST   | /reset-password       | `{ token, newPassword }`               | Token from forgot-password flow |
| GET    | /me                   | —                                       | Current user profile |

## Dashboard — `/dashboard`

| Method | Path            | Query          | Notes |
|--------|-----------------|----------------|-------|
| GET    | /summary         | —              | Today/week/month sales, order counts, AOV, low stock, best sellers |
| GET    | /sales-trend     | `days` (≤90)   | Daily revenue/orders series for the chart |

## Menu — `/menu`

| Method | Path              | Notes |
|--------|-------------------|-------|
| GET    | /categories        | List categories |
| POST   | /categories        | Manager+ only |
| GET    | /products          | `?search=&categoryId=&page=&limit=` |
| POST   | /products          | Manager+ only |
| PATCH  | /products/:id      | Manager+ only, partial update |
| DELETE | /products/:id      | Manager+ only, soft delete |

## Orders / POS — `/orders`

| Method | Path                | Body highlights | Notes |
|--------|---------------------|------------------|-------|
| GET    | /                    | `?status=&orderType=&page=` | List orders |
| GET    | /:id                 | —                | Order + items + payments |
| POST   | /                    | `{ orderType, tableId?, customerId?, items[] }` | Creates order, status `held` |
| POST   | /:id/items           | `{ items[] }`    | Append items to an open order |
| PATCH  | /:id/discount        | `{ discountPercent? , discountAmount?, couponCode? }` | Recomputes totals |
| POST   | /:id/checkout        | `{ payments[], serviceChargeId? }` | Completes order, deducts inventory |
| PATCH  | /:id/cancel          | `{ reason? }`    | Only if not already completed/cancelled |

Order item shape: `{ productId, variantId?, quantity, addonIds?, notes? }`
Payment shape: `{ method: cash|card|upi|wallet|mixed, amount, referenceNo? }`

## Tables — `/tables`

| Method | Path                     | Notes |
|--------|--------------------------|-------|
| GET    | /                         | Live floor layout for the user's outlet |
| PATCH  | /:id/status               | `{ status }` |
| POST   | /:id/transfer             | `{ targetTableId }` — moves the active order |
| POST   | /merge                    | `{ tableIds[], primaryTableId }` |
| GET    | /reservations/list        | Upcoming reservations |
| POST   | /reservations             | `{ tableId, guestName?, partySize?, reservedFor, ... }` |

## Kitchen Display — `/kds`

| Method | Path                          | Notes |
|--------|-------------------------------|-------|
| GET    | /tickets                       | Active tickets grouped by order, oldest/priority first |
| PATCH  | /items/:itemId/status          | `{ status: new|preparing|ready|served }` |
| PATCH  | /orders/:orderId/priority       | `{ isPriority }` |

## Inventory — `/inventory`

| Method | Path                                | Notes |
|--------|--------------------------------------|-------|
| GET    | /raw-materials                       | Stock levels + low-stock flag |
| POST   | /raw-materials                       | Manager+ |
| GET    | /stock-movements                     | `?rawMaterialId=` |
| POST   | /stock-movements                     | `{ rawMaterialId, movementType, quantity, ... }` |
| GET    | /suppliers                            | — |
| POST   | /suppliers                            | Manager+ |
| POST   | /purchase-orders                      | `{ supplierId, items[] }` |
| POST   | /purchase-orders/:id/receive          | GRN — increments stock, logs movements |

## Reports — `/reports` (manager+ only)

| Method | Path       | Query           |
|--------|------------|-----------------|
| GET    | /sales      | `from,to,groupBy` |
| GET    | /orders     | `from,to` |
| GET    | /products   | `from,to,type=best|slow` |
| GET    | /inventory  | `from,to` |
| GET    | /financial  | `from,to` |
| GET    | /customers  | — |
| GET    | /employees  | `from,to` |

## Customers — `/customers`

| Method | Path   | Notes |
|--------|--------|-------|
| GET    | /       | `?search=&page=` |
| GET    | /:id    | Profile + recent orders |
| POST   | /       | `{ fullName, phone?, email?, dateOfBirth? }` |

## Settings — `/settings`

| Method | Path | Notes |
|--------|------|-------|
| GET    | /     | Returns all settings as a flat `{ key: value }` object |
| PUT    | /     | Bulk upsert — owner/super_admin only. Body is `{ key: value, ... }` |

## Expenses — `/expenses`

| Method | Path         | Notes |
|--------|--------------|-------|
| GET    | /categories   | List expense categories |
| POST   | /categories   | `{ name }` — manager+ |
| GET    | /             | `?from=&to=&categoryId=&page=` |
| POST   | /             | `{ expenseCategoryId, amount, description?, isRecurring?, recurrenceInterval?, spentAt }` |
| DELETE | /:id          | manager+ |

## Employees — `/employees`

| Method | Path                     | Notes |
|--------|--------------------------|-------|
| GET    | /                         | Staff directory |
| POST   | /attendance/check-in      | `{ userId? }` — defaults to the caller |
| POST   | /attendance/check-out     | `{ userId? }` |
| GET    | /attendance               | `?from=&to=` |
| GET    | /shifts                   | — |
| POST   | /shifts                   | `{ name, startTime, endTime }` — manager+ |
| POST   | /shifts/assign            | `{ userId, shiftId, workDate }` — manager+ |
| POST   | /salary                   | `{ userId, baseSalary, effectiveFrom }` — manager+ |
| GET    | /salary/payments          | manager+ |
| POST   | /salary/payments          | `{ userId, periodMonth, amount }` — manager+ |

## Notifications — `/notifications`

| Method | Path        | Notes |
|--------|-------------|-------|
| GET    | /            | Returns `{ data, unreadCount }` — mine + broadcast, newest first |
| PATCH  | /:id/read    | Mark one as read |
| PATCH  | /read-all    | Mark all as read |

## CSV export

`GET /reports/sales`, `/reports/products`, and `/reports/financial` all accept
`?format=csv` to return a downloadable CSV file (`Content-Disposition: attachment`)
instead of JSON — opens natively in Excel/Google Sheets. All other query params
(`from`, `to`, `groupBy`, `type`) still apply.

## Product add-ons — `/menu/products/:id/addons`

| Method | Path                    | Notes |
|--------|-------------------------|-------|
| GET    | /menu/products/:id/addons | Addon groups + options configured for a product, used by the POS modifier picker |


## Split bill — `/orders/:id/splits`

| Method | Path                          | Body | Notes |
|--------|-------------------------------|------|-------|
| POST   | /orders/:id/splits             | `{ splits: [{ label, amount }, ...] }` (min 2, must sum to order total) | Creates guest shares |
| PATCH  | /orders/:id/splits/:splitId/pay | `{ method, referenceNo? }` | Settles one share; response includes `orderCompleted: true` once every share is paid |

## Combo meals — `/menu/combos`

| Method | Path    | Body | Notes |
|--------|---------|------|-------|
| GET    | /combos  | —    | Active combos with their constituent products |
| POST   | /combos  | `{ name, price, imageUrl?, items: [{ productId, quantity }] }` | Manager+ |

To order a combo, send it as a regular order item with `comboMealId` instead of
`productId`: `{ comboMealId, quantity, notes? }`. The backend expands it into the
constituent products automatically.

## Barcode lookup — `/menu/products/barcode/:code`

| Method | Path                        | Notes |
|--------|-----------------------------|-------|
| GET    | /menu/products/barcode/:code | Exact-match lookup for hardware barcode scanners |

## Receipt delivery — `/orders/:id/receipt`

| Method | Path                    | Body | Notes |
|--------|-------------------------|------|-------|
| GET    | /orders/:id/receipt/text | —    | Plain-text receipt, used by the Print button |
| POST   | /orders/:id/receipt/email | `{ email }` | Requires SMTP configured in `.env`; 400 with a clear message otherwise |
| POST   | /orders/:id/receipt/whatsapp | `{ phone }` | Returns `{ link }` — a `wa.me` deep link, no paid API key needed |

## Payroll — `/employees/salary/current`

| Method | Path                     | Notes |
|--------|--------------------------|-------|
| GET    | /employees/salary/current | Each employee's most recent base salary — manager+ |

(See the earlier Employees section for `/salary`, `/salary/payments` used to set/pay salaries.)

## PDF export

`GET /reports/sales` and `GET /reports/financial` also accept `?format=pdf` to
return a branded PDF (restaurant name in the header, summary lines, and a data
table) instead of JSON — generated with `pdfkit`, no external dependencies.

## Real-time updates (Socket.IO)

The API also runs a Socket.IO server on the same port. After connecting, emit
`authenticate` with the same JWT access token used for REST calls:

```js
const socket = io('/', { path: '/socket.io' });
socket.on('connect', () => socket.emit('authenticate', accessToken));
socket.on('kds:update', () => { /* refetch kitchen tickets */ });
socket.on('tables:update', () => { /* refetch table statuses */ });
```

The server joins the socket to an `outlet:<id>` room based on the token's outlet,
so updates never cross outlets. Events fire on: new order created, items added to
an order, checkout completed, kitchen item status changed, ticket priority changed,
table status changed, table transferred, and tables merged.
