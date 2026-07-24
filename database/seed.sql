-- ============================================================================
-- SEED DATA — demo restaurant "Spice Junction"
-- Run after schema.sql. Passwords below: Password@123
-- ============================================================================

-- 1. Roles & Permissions
INSERT INTO roles (id, name, description) VALUES
  ('11111111-0000-0000-0000-000000000001','super_admin','Full system access'),
  ('11111111-0000-0000-0000-000000000002','owner','Restaurant owner'),
  ('11111111-0000-0000-0000-000000000003','manager','Outlet manager'),
  ('11111111-0000-0000-0000-000000000004','cashier','Billing counter'),
  ('11111111-0000-0000-0000-000000000005','waiter','Floor staff'),
  ('11111111-0000-0000-0000-000000000006','kitchen_staff','Kitchen display access')
ON CONFLICT (id) DO NOTHING;

INSERT INTO permissions (code, description) VALUES
  ('pos.create_order','Create/edit POS orders'),
  ('menu.manage','Manage menu items'),
  ('inventory.manage','Manage stock'),
  ('reports.view_financial','View financial reports'),
  ('users.manage','Manage users & roles'),
  ('kds.view','View kitchen display')
ON CONFLICT (code) DO NOTHING;

-- 2. Restaurant & Outlet
INSERT INTO restaurants (id, name, legal_name, phone, email, city, state, currency_code)
VALUES ('22222222-0000-0000-0000-000000000001','Spice Junction','Spice Junction Foods Pvt Ltd',
        '+91-9876543210','owner@spicejunction.example','Agra','Uttar Pradesh','INR')
ON CONFLICT (id) DO NOTHING;

INSERT INTO outlets (id, restaurant_id, name, address, phone)
VALUES ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001',
        'Spice Junction — Sadar Bazaar','12 Sadar Bazaar Road, Agra','+91-9876543210')
ON CONFLICT (id) DO NOTHING;

-- 3. Users (Password: Password@123)
INSERT INTO users (id, restaurant_id, outlet_id, role_id, full_name, email, password_hash)
VALUES
 ('44444444-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002','Aman Sharma','owner@spicejunction.example',
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8kh9m6Y5g3Fw8y8f0v0mE6oV9pQeS.'),
 ('44444444-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000004','Priya Verma','cashier@spicejunction.example',
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8kh9m6Y5g3Fw8y8f0v0mE6oV9pQeS.'),
 ('44444444-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000005','Rohit Kumar','waiter@spicejunction.example',
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8kh9m6Y5g3Fw8y8f0v0mE6oV9pQeS.')
ON CONFLICT (id) DO NOTHING;

-- 4. Taxes & Charges
INSERT INTO tax_rates (id, restaurant_id, name, rate_percent, is_default) VALUES
  ('55555555-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','GST 5%',5.00,true),
  ('55555555-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','GST 18%',18.00,false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_charges (restaurant_id, name, rate_percent, applies_to)
VALUES ('22222222-0000-0000-0000-000000000001','Dine-in Service Charge',5.00,'dine_in');

-- 5. Categories & Products
INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES
  ('66666666-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','Starters',1),
  ('66666666-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','Main Course',2),
  ('66666666-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','Breads',3),
  ('66666666-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','Beverages',4),
  ('66666666-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001','Desserts',5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (restaurant_id, category_id, name, price, cost_price, tax_rate_id, is_veg) VALUES
 ('22222222-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000001','Paneer Tikka',220,90,'55555555-0000-0000-0000-000000000001',true),
 ('22222222-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000001','Chicken 65',260,110,'55555555-0000-0000-0000-000000000001',false),
 ('22222222-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000002','Butter Chicken',320,140,'55555555-0000-0000-0000-000000000001',false),
 ('22222222-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000002','Dal Makhani',210,70,'55555555-0000-0000-0000-000000000001',true),
 ('22222222-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000003','Butter Naan',45,12,'55555555-0000-0000-0000-000000000001',true),
 ('22222222-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000004','Masala Chaas',80,25,'55555555-0000-0000-0000-000000000001',true),
 ('22222222-0000-0000-0000-000000000001','66666666-0000-0000-0000-000000000005','Gulab Jamun (2 pc)',90,30,'55555555-0000-0000-0000-000000000001',true);

-- 6. Tables & Floors
INSERT INTO floors (id, outlet_id, name) VALUES
  ('77777777-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','Ground Floor')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dining_tables (floor_id, name, capacity, pos_x, pos_y, status) VALUES
 ('77777777-0000-0000-0000-000000000001','T1',2,40,40,'available'),
 ('77777777-0000-0000-0000-000000000001','T2',4,180,40,'occupied'),
 ('77777777-0000-0000-0000-000000000001','T3',4,320,40,'reserved'),
 ('77777777-0000-0000-0000-000000000001','T4',6,40,180,'cleaning'),
 ('77777777-0000-0000-0000-000000000001','T5',2,180,180,'available');

-- 7. Customers
INSERT INTO customers (restaurant_id, full_name, phone, email, loyalty_points) VALUES
 ('22222222-0000-0000-0000-000000000001','Neha Gupta','+91-9000011111','neha@example.com',150),
 ('22222222-0000-0000-0000-000000000001','Sanjay Mehta','+91-9000022222','sanjay@example.com',40);

-- 8. Units & Raw Materials
INSERT INTO units (name, abbreviation) VALUES
 ('Kilogram','kg'),('Litre','l'),('Piece','pc')
ON CONFLICT (abbreviation) DO NOTHING;

INSERT INTO raw_materials (restaurant_id, name, unit_id, current_stock, reorder_level)
SELECT '22222222-0000-0000-0000-000000000001', name, (SELECT id FROM units WHERE abbreviation = unit), stock, reorder
FROM (VALUES
  ('Paneer','kg', 4.5, 5),
  ('Chicken','kg', 12, 8),
  ('Butter','kg', 2, 3),
  ('Flour (Atta)','kg', 25, 10)
) AS r(name, unit, stock, reorder);

-- 9. Expenses
INSERT INTO expense_categories (restaurant_id, name) VALUES
 ('22222222-0000-0000-0000-000000000001','Rent'),
 ('22222222-0000-0000-0000-000000000001','Utilities'),
 ('22222222-0000-0000-0000-000000000001','Staff Salary');

-- 10. Completed Demo Order
DO $$
DECLARE
  v_order_id UUID;
  v_paneer UUID; v_naan UUID; v_chaas UUID;
BEGIN
  SELECT id INTO v_paneer FROM products WHERE name = 'Paneer Tikka' LIMIT 1;
  SELECT id INTO v_naan FROM products WHERE name = 'Butter Naan' LIMIT 1;
  SELECT id INTO v_chaas FROM products WHERE name = 'Masala Chaas' LIMIT 1;

  INSERT INTO orders (restaurant_id, outlet_id, order_number, order_type, cashier_id, status,
                       subtotal, tax_amount, total_amount, placed_at, completed_at)
  VALUES ('22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','ORD-0001','dine_in',
          '44444444-0000-0000-0000-000000000002','completed', 345, 17.25, 362.25, now() - interval '2 hours', now() - interval '1 hour')
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, unit_price, tax_amount, total_amount, kitchen_status) VALUES
   (v_order_id, v_paneer, 1, 220, 11, 231, 'served'),
   (v_order_id, v_naan, 2, 45, 4.5, 94.5, 'served'),
   (v_order_id, v_chaas, 1, 80, 4, 84, 'served');

  INSERT INTO order_payments (order_id, method, amount) VALUES (v_order_id, 'upi', 362.25);
END $$;