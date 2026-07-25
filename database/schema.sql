-- ============================================================================
-- RESTAURANT POS SYSTEM — COMPLETE POSTGRESQL SCHEMA
-- ============================================================================
-- Conventions:
--   * every business table has: id (uuid pk), created_at, updated_at, deleted_at (soft delete)
--   * every business table has an audit trail row written to audit_logs by trigger
--   * money stored as NUMERIC(12,2); quantities as NUMERIC(12,3) (fractional stock units)
--   * FKs use ON DELETE RESTRICT by default, ON DELETE SET NULL where historical
--     rows should survive deletion of the parent (e.g. an order after a customer
--     is removed), and ON DELETE CASCADE only for true child/line-item tables.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- fuzzy product name search

-- ----------------------------------------------------------------------------
-- Generic trigger: keep updated_at fresh
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generic trigger: write an audit row for INSERT/UPDATE/DELETE
CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  table_name    TEXT NOT NULL,
  record_id     UUID,
  action        TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data      JSONB,
  new_data      JSONB,
  changed_by    UUID,               -- users.id, nullable (system actions)
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_changed_at ON audit_logs(changed_at);

CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
DECLARE
  actor UUID;
BEGIN
  BEGIN
    actor := current_setting('app.current_user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    actor := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs(table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), actor);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), actor);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs(table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), actor);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Helper macro (applied manually per table below):
--   CREATE TRIGGER trg_<table>_updated_at BEFORE UPDATE ON <table>
--     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--   CREATE TRIGGER trg_<table>_audit AFTER INSERT OR UPDATE OR DELETE ON <table>
--     FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================================================
-- 1. RESTAURANTS / TENANTS (multi-outlet support)
-- ============================================================================
CREATE TABLE restaurants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  legal_name        TEXT,
  gstin             TEXT,
  phone             TEXT,
  email             CITEXT,
  address_line1     TEXT,
  address_line2     TEXT,
  city              TEXT,
  state             TEXT,
  country           TEXT DEFAULT 'IN',
  postal_code       TEXT,
  logo_url          TEXT,
  currency_code     TEXT NOT NULL DEFAULT 'INR',
  timezone          TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE outlets (                      -- physical branches of a restaurant brand
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  address           TEXT,
  phone             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- ============================================================================
-- 2. AUTH / USERS / ROLES / PERMISSIONS
-- ============================================================================
CREATE TABLE roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,   -- super_admin, owner, manager, cashier, waiter, kitchen_staff
  description   TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,   -- e.g. 'pos.create_order', 'reports.view_financial'
  description   TEXT
);

CREATE TABLE role_permissions (
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  outlet_id         UUID REFERENCES outlets(id) ON DELETE SET NULL,
  role_id           UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  full_name         TEXT NOT NULL,
  email             CITEXT NOT NULL,
  phone             TEXT,
  password_hash     TEXT NOT NULL,
  avatar_url        TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (restaurant_id, email)
);
CREATE INDEX idx_users_restaurant ON users(restaurant_id) WHERE deleted_at IS NULL;

CREATE TABLE refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    INET,
  user_agent    TEXT
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE password_reset_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE login_history (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address    INET,
  user_agent    TEXT,
  status        TEXT NOT NULL CHECK (status IN ('success','failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_history_user ON login_history(user_id, created_at DESC);

CREATE TABLE user_activity_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,          -- e.g. 'order.created', 'menu.updated'
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_activity_user ON user_activity_logs(user_id, created_at DESC);

-- ============================================================================
-- 3. MENU MANAGEMENT
-- ============================================================================
CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES categories(id) ON DELETE SET NULL,  -- subcategories
  name          TEXT NOT NULL,
  image_url     TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);

CREATE TABLE products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id       UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  sku               TEXT,
  barcode           TEXT,
  description       TEXT,
  image_url         TEXT,
  price             NUMERIC(12,2) NOT NULL,
  cost_price        NUMERIC(12,2) NOT NULL DEFAULT 0,   -- for profit margin
  tax_rate_id       UUID,                                -- see tax_rates below
  is_veg            BOOLEAN NOT NULL DEFAULT true,
  is_available      BOOLEAN NOT NULL DEFAULT true,
  track_inventory   BOOLEAN NOT NULL DEFAULT false,      -- linked to raw_materials via recipe
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (restaurant_id, barcode)
);
CREATE INDEX idx_products_restaurant_category ON products(restaurant_id, category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

CREATE TABLE product_variants (              -- e.g. Small / Medium / Large
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price_delta   NUMERIC(12,2) NOT NULL DEFAULT 0,   -- added/subtracted from base price
  is_default    BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE addon_groups (                  -- e.g. "Toppings", "Extra Cheese"
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  min_select      INT NOT NULL DEFAULT 0,
  max_select      INT NOT NULL DEFAULT 1
);

CREATE TABLE addons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_group_id  UUID NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE product_addon_groups (           -- link products <-> addon groups (modifiers)
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  addon_group_id  UUID NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, addon_group_id)
);

CREATE TABLE combo_meals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         NUMERIC(12,2) NOT NULL,
  image_url     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE combo_meal_items (
  combo_meal_id UUID NOT NULL REFERENCES combo_meals(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity      NUMERIC(12,3) NOT NULL DEFAULT 1,
  PRIMARY KEY (combo_meal_id, product_id)
);

-- ============================================================================
-- 4. TAX / DISCOUNT / COUPONS / SERVICE CHARGE
-- ============================================================================
CREATE TABLE tax_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,          -- e.g. "GST 5%", "GST 18%"
  rate_percent  NUMERIC(5,2) NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE products ADD CONSTRAINT fk_products_tax_rate
  FOREIGN KEY (tax_rate_id) REFERENCES tax_rates(id) ON DELETE SET NULL;

CREATE TABLE service_charges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  rate_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  applies_to    TEXT NOT NULL DEFAULT 'dine_in' CHECK (applies_to IN ('dine_in','take_away','delivery','all')),
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE coupons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code              TEXT NOT NULL,
  discount_type     TEXT NOT NULL CHECK (discount_type IN ('percent','flat')),
  discount_value    NUMERIC(12,2) NOT NULL,
  max_discount      NUMERIC(12,2),
  min_order_amount  NUMERIC(12,2) DEFAULT 0,
  usage_limit       INT,
  used_count        INT NOT NULL DEFAULT 0,
  valid_from        TIMESTAMPTZ,
  valid_until       TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (restaurant_id, code)
);

-- ============================================================================
-- 5. TABLE MANAGEMENT
-- ============================================================================
CREATE TABLE floors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id     UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  name          TEXT NOT NULL              -- "Ground Floor", "Rooftop"
);

CREATE TABLE dining_tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id      UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,             -- "T1", "T2"
  capacity      INT NOT NULL DEFAULT 2,
  pos_x         INT NOT NULL DEFAULT 0,    -- floor-plan coordinates
  pos_y         INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available','occupied','reserved','cleaning')),
  merged_into   UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dining_tables_floor ON dining_tables(floor_id);

CREATE TABLE reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id      UUID NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
  customer_id   UUID,                      -- FK added after customers table
  guest_name    TEXT,
  guest_phone   TEXT,
  party_size    INT NOT NULL DEFAULT 2,
  reserved_for  TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','seated','cancelled','no_show')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservations_table_time ON reservations(table_id, reserved_for);

-- ============================================================================
-- 6. CUSTOMERS / LOYALTY
-- ============================================================================
CREATE TABLE customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  phone             TEXT,
  email             CITEXT,
  date_of_birth     DATE,
  loyalty_points    INT NOT NULL DEFAULT 0,
  wallet_balance    NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_limit      NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_balance    NUMERIC(12,2) NOT NULL DEFAULT 0,
  membership_plan_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (restaurant_id, phone)
);
ALTER TABLE reservations ADD CONSTRAINT fk_reservations_customer
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

CREATE TABLE membership_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  annual_fee        NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  points_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1
);
ALTER TABLE customers ADD CONSTRAINT fk_customers_membership
  FOREIGN KEY (membership_plan_id) REFERENCES membership_plans(id) ON DELETE SET NULL;

CREATE TABLE customer_wallet_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,          -- +credit / -debit
  type          TEXT NOT NULL CHECK (type IN ('topup','redeem','refund','adjustment')),
  reference_order_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loyalty_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points        INT NOT NULL,                    -- +earned / -redeemed
  order_id      UUID,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. ORDERS / POS BILLING
-- ============================================================================
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  outlet_id           UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  order_number        TEXT NOT NULL,              -- human readable, per-outlet sequence
  order_type          TEXT NOT NULL CHECK (order_type IN ('dine_in','take_away','delivery')),
  table_id            UUID REFERENCES dining_tables(id) ON DELETE SET NULL,
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  waiter_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  cashier_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'held'
                      CHECK (status IN ('held','placed','preparing','ready','served','completed','cancelled')),
  subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  coupon_id           UUID REFERENCES coupons(id) ON DELETE SET NULL,
  service_charge_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  round_off           NUMERIC(6,2)  NOT NULL DEFAULT 0,
  total_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  cancel_reason        TEXT,
  is_priority          BOOLEAN NOT NULL DEFAULT false,
  placed_at           TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  UNIQUE (outlet_id, order_number)
);
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_table ON orders(table_id);

CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id        UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity          NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price        NUMERIC(12,2) NOT NULL,
  tax_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL,
  kitchen_status    TEXT NOT NULL DEFAULT 'new'
                    CHECK (kitchen_status IN ('new','preparing','ready','served')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_kitchen_status ON order_items(kitchen_status);

CREATE TABLE order_item_addons (
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  addon_id      UUID NOT NULL REFERENCES addons(id) ON DELETE RESTRICT,
  price         NUMERIC(12,2) NOT NULL,
  PRIMARY KEY (order_item_id, addon_id)
);

CREATE TABLE order_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method        TEXT NOT NULL CHECK (method IN ('cash','card','upi','wallet','mixed')),
  amount        NUMERIC(12,2) NOT NULL,
  reference_no  TEXT,
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_payments_order ON order_payments(order_id);

CREATE TABLE order_splits (                 -- split-bill support
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  split_label   TEXT NOT NULL,              -- "Guest 1", "Guest 2"
  amount        NUMERIC(12,2) NOT NULL,
  is_paid       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE order_refunds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,
  reason        TEXT,
  refunded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('print','email','whatsapp')),
  sent_to         TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. INVENTORY / RAW MATERIALS / SUPPLIERS / PURCHASE
-- ============================================================================
CREATE TABLE units (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,        -- kg, litre, piece
  abbreviation  TEXT NOT NULL UNIQUE
);

CREATE TABLE raw_materials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  unit_id           UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  current_stock     NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_level     NUMERIC(12,3) NOT NULL DEFAULT 0,
  expiry_tracked    BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_raw_materials_restaurant ON raw_materials(restaurant_id);

CREATE TABLE product_recipes (               -- BOM: product -> raw materials consumed
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id   UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  quantity_required NUMERIC(12,3) NOT NULL,
  PRIMARY KEY (product_id, raw_material_id)
);

CREATE TABLE suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact_person TEXT,
  phone         TEXT,
  email         CITEXT,
  address       TEXT,
  gstin         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  po_number       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','ordered','partially_received','received','cancelled')),
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, po_number)
);

CREATE TABLE purchase_order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  raw_material_id     UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  quantity_ordered    NUMERIC(12,3) NOT NULL,
  quantity_received   NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_price          NUMERIC(12,2) NOT NULL
);

CREATE TABLE goods_receipt_notes (            -- GRN
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  grn_number          TEXT NOT NULL,
  received_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_returns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  raw_material_id     UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  quantity            NUMERIC(12,3) NOT NULL,
  reason              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE supplier_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  amount        NUMERIC(12,2) NOT NULL,
  method        TEXT,
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_movements (                -- unified ledger: in/out/adjustment/transfer/wastage
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id   UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  outlet_id         UUID REFERENCES outlets(id) ON DELETE SET NULL,
  movement_type     TEXT NOT NULL CHECK (movement_type IN
                    ('stock_in','stock_out','adjustment','wastage','transfer_in','transfer_out','sale_deduction')),
  quantity          NUMERIC(12,3) NOT NULL,      -- always positive; sign implied by movement_type
  reference_type    TEXT,                        -- 'purchase_order','order','manual'
  reference_id      UUID,
  expiry_date       DATE,
  batch_no          TEXT,
  notes             TEXT,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_material ON stock_movements(raw_material_id, created_at DESC);

-- ============================================================================
-- 9. EMPLOYEES / ATTENDANCE / SHIFTS / PAYROLL
-- ============================================================================
CREATE TABLE shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id     UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,          -- "Morning", "Evening"
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL
);

CREATE TABLE employee_shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id      UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  work_date     DATE NOT NULL,
  UNIQUE (user_id, work_date)
);

CREATE TABLE attendance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in      TIMESTAMPTZ NOT NULL,
  check_out     TIMESTAMPTZ,
  work_date     DATE NOT NULL,
  UNIQUE (user_id, work_date)
);

CREATE TABLE salaries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  base_salary       NUMERIC(12,2) NOT NULL,
  effective_from    DATE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE salary_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month  DATE NOT NULL,               -- first day of month
  amount        NUMERIC(12,2) NOT NULL,
  paid_at       TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid'))
);

-- ============================================================================
-- 10. EXPENSES
-- ============================================================================
CREATE TABLE expense_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL
);

CREATE TABLE expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  outlet_id         UUID REFERENCES outlets(id) ON DELETE SET NULL,
  expense_category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount            NUMERIC(12,2) NOT NULL,
  description       TEXT,
  is_recurring      BOOLEAN NOT NULL DEFAULT false,
  recurrence_interval TEXT CHECK (recurrence_interval IN ('daily','weekly','monthly','yearly')),
  spent_at          DATE NOT NULL,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_restaurant_date ON expenses(restaurant_id, spent_at);

-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,   -- NULL = broadcast to all roles/outlet
  type          TEXT NOT NULL,     -- 'low_stock','new_order','reservation','payment','system'
  title         TEXT NOT NULL,
  message       TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

-- ============================================================================
-- 12. SETTINGS
-- ============================================================================
CREATE TABLE settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,          -- 'receipt.footer_text', 'printer.ip', 'theme.mode'...
  value         JSONB NOT NULL,
  UNIQUE (restaurant_id, key)
);

-- ============================================================================
-- TRIGGERS: apply updated_at + audit to the tables that need it
-- ============================================================================
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'restaurants','outlets','users','categories','products','tax_rates',
    'dining_tables','customers','orders','raw_materials','suppliers',
    'purchase_orders','expenses'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
                     FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON %I
                     FOR EACH ROW EXECUTE FUNCTION audit_trigger();', t, t);
  END LOOP;
END $$;

