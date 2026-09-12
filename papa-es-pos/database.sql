DROP DATABASE IF EXISTS papa_es_pos;
CREATE DATABASE papa_es_pos;
USE papa_es_pos;

-- ===========================================================================
-- TABLES DEFINITION
-- ===========================================================================

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('OWNER','MANAGER','CASHIER','KITCHEN') NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ingredient_name VARCHAR(120) NOT NULL,
  unit_measure VARCHAR(40) NOT NULL,
  stock_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  parent_group VARCHAR(100) DEFAULT NULL,
  sub_category VARCHAR(100) DEFAULT NULL,
  sell_price DECIMAL(12,2) NOT NULL,
  image_url VARCHAR(255) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  qty_required DECIMAL(12,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recipe_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_recipe_ing FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_recipe (menu_item_id, ingredient_id)
);

CREATE TABLE sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  or_number VARCHAR(50) NOT NULL UNIQUE,
  cashier_id INT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'NONE',
  discount_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH',
  order_type VARCHAR(20) NOT NULL DEFAULT 'DINE_IN',
  table_number VARCHAR(20) NULL,
  order_note VARCHAR(255) NULL,
  cash_received DECIMAL(12,2) NOT NULL,
  change_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  cancel_reason VARCHAR(255) NULL,
  cancelled_by INT NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_id) REFERENCES users(id),
  CONSTRAINT fk_sales_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  cost_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_saleitems_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_saleitems_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE inventory_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ingredient_id INT NOT NULL,
  movement_type ENUM('RESTOCK','DEDUCT','ADJUSTMENT') NOT NULL,
  qty DECIMAL(12,4) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  reference_type VARCHAR(40) DEFAULT NULL,
  reference_id INT DEFAULT NULL,
  user_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_ing FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
  CONSTRAINT fk_mov_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE audit_trails (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id INT NULL,
  details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE void_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_order_ref VARCHAR(64) NULL,
  menu_item_id INT NULL,
  item_name VARCHAR(120) NOT NULL,
  action_type ENUM('VOID_QTY','VOID_ITEM','COMP') NOT NULL,
  void_qty INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  reason VARCHAR(255) NOT NULL,
  manager_pin_used VARCHAR(20) NOT NULL,
  cashier_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_void_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_void_cashier FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ===========================================================================
-- INITIAL SEED DATA
-- ===========================================================================

-- 1. USERS
INSERT INTO users (full_name, username, password_hash, role) VALUES
('Papa Es Owner', 'admin', '$2a$10$XDrs7atK/yzKY6r67wVXMey5AxMEMcvyyyBz/To5B5q9zDC82VqIC', 'OWNER'),
('Manager', 'manager', '$2a$10$XDrs7atK/yzKY6r67wVXMey5AxMEMcvyyyBz/To5B5q9zDC82VqIC', 'MANAGER'),
('Cashier', 'cashier', '$2a$10$XDrs7atK/yzKY6r67wVXMey5AxMEMcvyyyBz/To5B5q9zDC82VqIC', 'CASHIER'),
('Kitchen', 'kitchen', '$2a$10$XDrs7atK/yzKY6r67wVXMey5AxMEMcvyyyBz/To5B5q9zDC82VqIC', 'KITCHEN');

-- 2. INGREDIENTS
INSERT INTO ingredients (ingredient_name, unit_measure, stock_qty, reorder_level, unit_cost) VALUES
('Raw Shrimp', 'g', 10000, 2000, 0.45),
('Lemon Juice', 'ml', 5000, 1000, 0.08),
('Salt', 'g', 10000, 1000, 0.02),
('Black Pepper', 'g', 5000, 500, 0.08),
('Flour', 'g', 20000, 3000, 0.04),
('Cornstarch', 'g', 15000, 2000, 0.05),
('Baking Powder', 'g', 2000, 300, 0.06),
('Egg', 'pc', 500, 50, 7.00),
('Cooking Oil', 'ml', 50000, 5000, 0.03),
('Sweet and Sour Sauce', 'ml', 10000, 1500, 0.06),
('Raw Boneless Chicken', 'g', 30000, 4000, 0.22),
('Pita Bread', 'pc', 150, 30, 12.00),
('Garlic White Sauce', 'ml', 10000, 1500, 0.07),
('Lettuce', 'g', 8000, 1000, 0.08),
('Tomato', 'g', 12000, 1500, 0.09),
('Cucumber', 'g', 8000, 1000, 0.06),
('Frozen Fries', 'g', 25000, 3000, 0.04),
('Shawarma Spices', 'g', 2000, 300, 0.15),
('Dry Pasta', 'g', 15000, 2000, 0.06),
('Basil Pesto', 'g', 5000, 800, 0.35),
('Cooking Cream', 'ml', 15000, 2000, 0.14),
('Olive Oil', 'ml', 10000, 1500, 0.25),
('Garlic', 'g', 10000, 1500, 0.06),
('Parmesan Cheese', 'g', 5000, 800, 0.40),
('Raw Bacon', 'g', 10000, 1500, 0.30),
('Pizza Dough', 'pc', 200, 30, 25.00),
('Pizza Sauce', 'g', 12000, 1500, 0.08),
('Mozzarella Cheese', 'g', 15000, 2000, 0.38),
('Fresh Basil', 'g', 1000, 200, 0.20),
('Marinara Sauce', 'g', 12000, 1500, 0.08),
('Dried Oregano', 'g', 1000, 200, 0.15),
('Raw Rice Cakes', 'g', 15000, 2000, 0.12),
('Fish Cakes', 'g', 10000, 1500, 0.14),
('Gochujang', 'g', 10000, 1500, 0.20),
('Gochugaru', 'g', 5000, 800, 0.22),
('Soy Sauce', 'ml', 20000, 3000, 0.04),
('Sugar', 'g', 15000, 2000, 0.03),
('Green Onion', 'g', 8000, 1000, 0.08),
('Seaweed Sheets', 'pc', 300, 50, 4.00),
('Raw Rice', 'g', 50000, 5000, 0.05),
('Sesame Oil', 'ml', 10000, 1500, 0.18),
('Pickled Radish', 'g', 5000, 800, 0.12),
('Spam', 'g', 10000, 1500, 0.28),
('Carrots', 'g', 15000, 2000, 0.06),
('Spinach', 'g', 8000, 1000, 0.10),
('Raw Beef', 'g', 25000, 3000, 0.38),
('Bean Sprouts', 'g', 5000, 800, 0.05),
('Shiitake Mushrooms', 'g', 5000, 800, 0.30),
('Zucchini', 'g', 5000, 800, 0.09),
('Sesame Seeds', 'g', 2000, 300, 0.15),
('Kimchi', 'g', 15000, 2000, 0.16),
('Kimchi Juice', 'ml', 5000, 800, 0.05),
('Raw Squid', 'g', 15000, 2000, 0.32),
('Raw Pork Belly', 'g', 35000, 4000, 0.28),
('Onion', 'g', 20000, 2500, 0.05),
('Korean Sweet and Spicy Sauce', 'ml', 10000, 1500, 0.12),
('Korean Soy Garlic Sauce', 'ml', 10000, 1500, 0.12),
('Tofu', 'g', 8000, 1000, 0.08),
('Raw Beef Ribs', 'g', 15000, 2000, 0.42),
('Radish', 'g', 10000, 1500, 0.05),
('Dry Glass Noodles', 'g', 10000, 1500, 0.10),
('Ramen Noodles', 'pc', 200, 40, 18.00),
('Hotdog', 'g', 8000, 1000, 0.16),
('Baked Beans', 'g', 5000, 800, 0.12),
('Cheese Slice', 'pc', 300, 50, 8.00),
('Tartar Sauce', 'ml', 8000, 1000, 0.10),
('Raw Pork Mesentery', 'g', 15000, 2000, 0.18),
('Bay Leaves', 'pc', 500, 100, 0.50),
('Whole Peppercorn', 'g', 2000, 300, 0.10),
('Spiced Vinegar', 'ml', 20000, 2500, 0.04),
('Ketchup', 'ml', 10000, 1500, 0.05),
('Raw Ground Pork', 'g', 20000, 2500, 0.24),
('Lumpia Wrapper', 'pc', 500, 100, 1.50),
('Sweet Chili Sauce', 'ml', 12000, 1500, 0.07),
('Teriyaki Sauce', 'ml', 8000, 1000, 0.12),
('Ginger', 'g', 5000, 800, 0.08),
('Butter', 'g', 10000, 1500, 0.25),
('Bitter Gourd', 'g', 10000, 1200, 0.07),
('Oyster Sauce', 'ml', 15000, 2000, 0.08),
('Squash', 'g', 15000, 2000, 0.05),
('String Beans', 'g', 12000, 1500, 0.06),
('Coconut Milk', 'ml', 20000, 2500, 0.08),
('Fish Sauce', 'ml', 15000, 2000, 0.04),
('Cabbage', 'g', 25000, 3000, 0.04),
('Cauliflower', 'g', 10000, 1200, 0.12),
('Bell Pepper', 'g', 10000, 1200, 0.14),
('Raw Chicken Liver', 'g', 8000, 1000, 0.15),
('Quail Eggs', 'pc', 300, 50, 2.50),
('Eggplant', 'g', 15000, 2000, 0.06),
('Okra', 'g', 8000, 1000, 0.06),
('Shrimp Paste', 'g', 12000, 1500, 0.12),
('Raw Pork Knuckle', 'g', 30000, 4000, 0.26),
('Peanut Kare-Kare Sauce', 'ml', 20000, 2500, 0.10),
('Pechay', 'g', 12000, 1500, 0.05),
('Banana Blossom', 'g', 5000, 800, 0.08),
('Raw Chicken', 'g', 40000, 5000, 0.20),
('Chicken Marinade', 'ml', 10000, 1500, 0.06),
('Chicken Breading', 'g', 15000, 2000, 0.06),
('Gravy', 'ml', 15000, 2000, 0.06),
('Chili', 'g', 5000, 800, 0.12),
('Specialty Glaze', 'ml', 10000, 1500, 0.12),
('Vinegar', 'ml', 20000, 2500, 0.03),
('Raw Deboned Chicken', 'g', 20000, 3000, 0.25),
('Country Gravy', 'ml', 12000, 1500, 0.08),
('Raw Chicken Breast', 'g', 15000, 2000, 0.26),
('Ham', 'g', 8000, 1000, 0.22),
('Breadcrumbs', 'g', 10000, 1500, 0.06),
('White Cream Sauce', 'ml', 10000, 1500, 0.10),
('Raw Beef Shank', 'g', 20000, 2500, 0.36),
('Sweet Corn', 'g', 8000, 1000, 0.08),
('Green Beans', 'g', 6000, 800, 0.06),
('Sinigang Mix', 'g', 5000, 800, 0.15),
('Kangkong', 'g', 10000, 1200, 0.04),
('Green Chili', 'pc', 300, 50, 1.50),
('Raw Milkfish', 'g', 15000, 2000, 0.24),
('Raw Salmon', 'g', 12000, 1500, 0.55),
('Raw Maliputo Fish', 'g', 15000, 2000, 0.48),
('Red Onion', 'g', 12000, 1500, 0.07),
('Calamansi Juice', 'ml', 10000, 1500, 0.08),
('Mayonnaise', 'g', 12000, 1500, 0.11),
('Five Spice Seasoning', 'g', 1000, 200, 0.20),
('Lechon Sauce', 'ml', 8000, 1000, 0.08),
('Raw Pork Loin', 'g', 15000, 2000, 0.28),
('Raw Pork Shoulder', 'g', 20000, 2500, 0.26),
('Tomato Sauce', 'ml', 15000, 2000, 0.06),
('Saba Banana', 'pc', 200, 30, 4.00),
('Chickpeas', 'g', 5000, 800, 0.10),
('Potato', 'g', 15000, 2000, 0.05),
('Liver Spread', 'g', 6000, 800, 0.18),
('Cheese', 'g', 10000, 1500, 0.28),
('Sprite', 'ml', 10000, 1500, 0.04),
('Raw Green Mussels', 'g', 15000, 2000, 0.16),
('Tempura Batter Mix', 'g', 8000, 1000, 0.08),
('Tempura Sauce', 'ml', 6000, 800, 0.10),
('BBQ Marinade', 'ml', 8000, 1000, 0.08),
('Raw Pork Maskara', 'g', 20000, 2500, 0.18),
('Raw Fish Fillet', 'g', 10000, 1500, 0.25),
('Frozen Mixed Veggies', 'g', 8000, 1000, 0.09),
('Green Mango', 'g', 5000, 800, 0.08),
('Burger Bun', 'pc', 200, 40, 6.00),
('Sliced Bread', 'pc', 300, 50, 2.00),
('Canned Tuna', 'g', 6000, 800, 0.22),
('Dry Pancit Canton', 'g', 12000, 1500, 0.06),
('Dry Pancit Bihon', 'g', 12000, 1500, 0.06),
('Fishballs', 'g', 10000, 1500, 0.10),
('Dry Sotanghon', 'g', 8000, 1000, 0.09),
('Wood Ear Mushroom', 'g', 2000, 300, 0.25),
('Dry Mixed Noodles', 'g', 25000, 3000, 0.06),
('Calamansi', 'pc', 500, 100, 1.00),
('Bilao Tray', 'pc', 100, 20, 25.00),
('Raw Pork Skewers', 'pc', 200, 40, 15.00),
('Lumpia', 'pc', 300, 50, 8.00),
('Salted Egg', 'pc', 150, 30, 12.00),
('Banana Leaf', 'pc', 150, 30, 5.00),
('Condensed Milk', 'ml', 15000, 2000, 0.12),
('Evaporated Milk', 'ml', 15000, 2000, 0.09),
('Vanilla Extract', 'ml', 1000, 200, 0.25),
('Cucumber Lemonade Powder', 'g', 8000, 1000, 0.15),
('Lemon', 'g', 5000, 800, 0.14),
('Iced Tea Powder', 'g', 8000, 1000, 0.14),
('San Mig Light Bottle', 'pc', 120, 24, 55.00),
('San Mig Apple Bottle', 'pc', 120, 24, 55.00),
('Red Horse Bottle', 'pc', 120, 24, 55.00),
('Coke Zero Can', 'pc', 120, 24, 40.00),
('Royal Can', 'pc', 120, 24, 40.00),
('Sprite Can', 'pc', 120, 24, 40.00),
('Pineapple Juice Can', 'pc', 120, 24, 40.00),
('Party Pan Container', 'pc', 100, 20, 35.00);

-- 3. MEDITERRANEAN MENU
INSERT INTO menu_items (item_name, category, parent_group, sub_category, sell_price, is_active) VALUES
('Camaron Rebosado', 'Appetizers', 'Mediterranean', 'Appetizers', 428.00, 1),
('Chicken Shawarma Delight with Fries', 'Chicken', 'Mediterranean', 'Chicken', 198.00, 1),
('Pesto Pasta', 'Pasta', 'Mediterranean', 'Pasta', 398.00, 1),
('Carbonara', 'Pasta', 'Mediterranean', 'Pasta', 398.00, 1),
('Margherita Pizza', 'Pizza', 'Mediterranean', 'Pizza', 398.00, 1),
('Marinara Pizza', 'Pizza', 'Mediterranean', 'Pizza', 498.00, 1);

-- 4. KOREAN MENU
INSERT INTO menu_items (item_name, category, parent_group, sub_category, sell_price, is_active) VALUES
('Tteok-Bokki', 'Appetizers', 'Korean', 'Appetizers', 278.00, 1),
('Cheese Tteok-Bokki', 'Appetizers', 'Korean', 'Appetizers', 298.00, 1),
('Kimbap / Gimbap', 'Appetizers', 'Korean', 'Appetizers', 198.00, 1),
('Bibimbap', 'Rice Meal', 'Korean', 'Rice Meal', 298.00, 1),
('Kimchi Bokkeumbap', 'Rice Meal', 'Korean', 'Rice Meal', 338.00, 1),
('Osam-Bulgogi', 'Sizzling', 'Korean', 'Sizzling', 498.00, 1),
('Yangnyeom Chicken (whole)', 'Chicken', 'Korean', 'Chicken', 898.00, 1),
('Yangnyeom Chicken (half)', 'Chicken', 'Korean', 'Chicken', 498.00, 1),
('Soy Garlic Chicken (whole)', 'Chicken', 'Korean', 'Chicken', 898.00, 1),
('Soy Garlic Chicken (half)', 'Chicken', 'Korean', 'Chicken', 498.00, 1),
('Kimchi Jigae', 'Soup', 'Korean', 'Soup', 388.00, 1),
('Galbitang', 'Soup', 'Korean', 'Soup', 398.00, 1),
('Budi Jigae Ramen', 'Ramen', 'Korean', 'Ramen', 428.00, 1),
('Rabokki Ramen', 'Ramen', 'Korean', 'Ramen', 368.00, 1),
('Japchae', 'Noodles', 'Korean', 'Noodles', 428.00, 1);

-- 5. THE DINER MENU (A la Carte)
INSERT INTO menu_items (item_name, category, parent_group, sub_category, sell_price, is_active) VALUES
('Calamares', 'Appetizers', 'The Diner (A la Carte)', 'Appetizers', 288.00, 1),
('Chicharon Bulaklak', 'Appetizers', 'The Diner (A la Carte)', 'Appetizers', 288.00, 1),
('French Fries', 'Appetizers', 'The Diner (A la Carte)', 'Appetizers', 188.00, 1),
('Shanghai Fingers', 'Appetizers', 'The Diner (A la Carte)', 'Appetizers', 288.00, 1),
('Teriyaki Shrimp', 'Appetizers', 'The Diner (A la Carte)', 'Appetizers', 498.00, 1),
('Ampalaya Con Carne', 'Veggies', 'The Diner (A la Carte)', 'Veggies', 328.00, 1),
('Ginataang Kalabasa', 'Veggies', 'The Diner (A la Carte)', 'Veggies', 298.00, 1),
('Chopsuey', 'Veggies', 'The Diner (A la Carte)', 'Veggies', 298.00, 1),
('Pinakbet', 'Veggies', 'The Diner (A la Carte)', 'Veggies', 298.00, 1),
('Ensaladang Talong', 'Veggies', 'The Diner (A la Carte)', 'Veggies', 298.00, 1),
('Crispy Pata Jumbo', 'Crispy Pata', 'The Diner (A la Carte)', 'Crispy Pata', 898.00, 1),
('Crispy Pata Super Jumbo', 'Crispy Pata', 'The Diner (A la Carte)', 'Crispy Pata', 998.00, 1),
('Crispy Pata Kare-Kare', 'Crispy Pata', 'The Diner (A la Carte)', 'Crispy Pata', 1398.00, 1),
('Papa Es Fried Chicken', 'Chicken', 'The Diner (A la Carte)', 'Chicken', 438.00, 1),
('Sizzling Chicken', 'Chicken', 'The Diner (A la Carte)', 'Chicken', 438.00, 1),
('Vanni\'s Chicken', 'Chicken', 'The Diner (A la Carte)', 'Chicken', 498.00, 1),
('Adobong Paiga na may sabaw na pahapyaw', 'Chicken', 'The Diner (A la Carte)', 'Chicken', 438.00, 1),
('Boneless Whole Chicken with Country Gravy', 'Chicken', 'The Diner (A la Carte)', 'Chicken', 728.00, 1),
('Chicken Cordon Bleu', 'Chicken', 'The Diner (A la Carte)', 'Chicken', 448.00, 1),
('Batangas Bulalo', 'Soup', 'The Diner (A la Carte)', 'Soup', 998.00, 1),
('Sinigang na Baboy', 'Soup', 'The Diner (A la Carte)', 'Soup', 418.00, 1),
('Sinigang na Bangus', 'Soup', 'The Diner (A la Carte)', 'Soup', 418.00, 1),
('Sinigang na Hipon', 'Soup', 'The Diner (A la Carte)', 'Soup', 468.00, 1),
('Sinigang na Salmon', 'Soup', 'The Diner (A la Carte)', 'Soup', 438.00, 1),
('Sinigang na Maliputo', 'Soup', 'The Diner (A la Carte)', 'Soup', 898.00, 1),
('Bagnet Kare-Kare', 'Pork', 'The Diner (A la Carte)', 'Pork', 428.00, 1),
('Crispy Pork Dinakdakan', 'Pork', 'The Diner (A la Carte)', 'Pork', 398.00, 1),
('Lechon Macau', 'Pork', 'The Diner (A la Carte)', 'Pork', 368.00, 1),
('Pork Binagoongan', 'Pork', 'The Diner (A la Carte)', 'Pork', 398.00, 1),
('Crispy Pork Bicol Express', 'Pork', 'The Diner (A la Carte)', 'Pork', 398.00, 1),
('Pork Bistek', 'Pork', 'The Diner (A la Carte)', 'Pork', 428.00, 1),
('Putchero', 'Pork', 'The Diner (A la Carte)', 'Pork', 598.00, 1),
('Pork Adobo', 'Pork', 'The Diner (A la Carte)', 'Pork', 468.00, 1),
('Kalderetang Baka', 'Beef', 'The Diner (A la Carte)', 'Beef', 448.00, 1),
('Buttered Shrimp', 'Seafood', 'The Diner (A la Carte)', 'Seafood', 438.00, 1),
('Baked Tahong', 'Seafood', 'The Diner (A la Carte)', 'Seafood', 398.00, 1),
('Shrimp Tempura', 'Seafood', 'The Diner (A la Carte)', 'Seafood', 428.00, 1),
('Fried Maliputo with ensaladang talong', 'Seafood', 'The Diner (A la Carte)', 'Seafood', 848.00, 1),
('Seafood Kare-Kare', 'Seafood', 'The Diner (A la Carte)', 'Seafood', 858.00, 1),
('Grilled Liempo', 'Grilled', 'The Diner (A la Carte)', 'Grilled', 398.00, 1),
('Inihaw na Pusit', 'Grilled', 'The Diner (A la Carte)', 'Grilled', 428.00, 1),
('Papa Es Sisig', 'Sizzling', 'The Diner (A la Carte)', 'Sizzling', 348.00, 1),
('Sizzling Bangus', 'Sizzling', 'The Diner (A la Carte)', 'Sizzling', 358.00, 1),
('Sizzling Seafood', 'Sizzling', 'The Diner (A la Carte)', 'Sizzling', 498.00, 1);

-- 6. THE DINER MENU (Rice, Sandwiches, Pansit, Drinks & Dessert)
INSERT INTO menu_items (item_name, category, parent_group, sub_category, sell_price, is_active) VALUES
('Plain Rice Platter', 'Rice', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Rice', 198.00, 1),
('Garlic Rice Platter', 'Rice', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Rice', 258.00, 1),
('Yang Chao Rice Platter', 'Rice', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Rice', 378.00, 1),
('Seafood Rice Platter', 'Rice', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Rice', 378.00, 1),
('Bagoong Rice', 'Rice', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Rice', 378.00, 1),
('Plain Rice (Solo)', 'Rice', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Rice', 48.00, 1),
('Chicken Sandwich with Fries', 'Sandwich', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Sandwich', 258.00, 1),
('Clubhouse Sandwich with Fries', 'Sandwich', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Sandwich', 258.00, 1),
('Tuna Sandwich with Fries', 'Sandwich', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Sandwich', 258.00, 1),
('Canton / Bihon Mixed', 'Pansit', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Pansit', 298.00, 1),
('Canton / Sotanghon Mixed', 'Pansit', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Pansit', 298.00, 1),
('Pansit sa Bilao Small (4 - 6 pax)', 'Pansit', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Pansit', 550.00, 1),
('Pansit sa Bilao Medium (8 - 10 pax)', 'Pansit', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Pansit', 850.00, 1),
('Pansit sa Bilao Large (12 - 15 pax)', 'Pansit', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Pansit', 900.00, 1),
('Kamayan Meat', 'Kamayan', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Kamayan', 3088.00, 1),
('Kamayan Seafood', 'Kamayan', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Kamayan', 3288.00, 1),
('Kamayan Mixed', 'Kamayan', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Kamayan', 6198.00, 1),
('Kamayan sa Bilao', 'Kamayan', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Kamayan', 2598.00, 1),
('Leche Flan', 'Dessert', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Dessert', 155.00, 1),
('Cucumber Lemonade Pitcher', 'Drinks', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Drinks', 198.00, 1),
('Ice Tea Lemonade Pitcher', 'Drinks', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Drinks', 198.00, 1),
('Cucumber Lemonade Single', 'Drinks', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Drinks', 95.00, 1),
('Ice Tea Lemonade Single', 'Drinks', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Drinks', 95.00, 1),
('San Mig Light', 'Beer', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Beer', 115.00, 1),
('San Mig Apple', 'Beer', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Beer', 115.00, 1),
('Red Horse Stallion', 'Beer', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Beer', 115.00, 1),
('Coke Zero Can', 'Drinks', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Drinks', 95.00, 1),
('Royal Can', 'Drinks', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Drinks', 95.00, 1),
('Sprite Can', 'Drinks', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Drinks', 95.00, 1),
('Pineapple Can', 'Drinks', 'The Diner (Rice, Sandwiches, Pansit, Drinks & Dessert)', 'Drinks', 95.00, 1);

-- 7. PARTY PAN MENU (8 - 10 PAX)
INSERT INTO menu_items (item_name, category, parent_group, sub_category, sell_price, is_active) VALUES
('Party Pan Bagnet Kare-Kare', 'Pork', 'Party Pan', 'Pork', 1750.00, 1),
('Party Pan Crispy Pork Bicol Express', 'Pork', 'Party Pan', 'Pork', 1750.00, 1),
('Party Pan Crispy Pork Dinakdakan', 'Pork', 'Party Pan', 'Pork', 1750.00, 1),
('Party Pan Lechon Macau', 'Pork', 'Party Pan', 'Pork', 1650.00, 1),
('Party Pan Pork Binagoongan', 'Pork', 'Party Pan', 'Pork', 1750.00, 1),
('Party Pan Papa Es Pork Sisig', 'Pork', 'Party Pan', 'Pork', 1300.00, 1),
('Party Pan Chicharon Bulaklak', 'Pork', 'Party Pan', 'Pork', 1150.00, 1),
('Party Pan Shanghai Fingers', 'Pork', 'Party Pan', 'Pork', 2350.00, 1),
('Party Pan Pork Bistek', 'Pork', 'Party Pan', 'Pork', 1880.00, 1),
('Party Pan Pork Adobo', 'Pork', 'Party Pan', 'Pork', 2050.00, 1),
('Party Pan Putchero', 'Pork', 'Party Pan', 'Pork', 2650.00, 1),
('Party Pan Papa Es Fried Chicken', 'Chicken', 'Party Pan', 'Chicken', 1850.00, 1),
('Party Pan Boneless Whole Chicken with Country Gravy', 'Chicken', 'Party Pan', 'Chicken', 2300.00, 1),
('Party Pan Vanni\'s Chicken', 'Chicken', 'Party Pan', 'Chicken', 2200.00, 1),
('Party Pan Adobong Paiga', 'Chicken', 'Party Pan', 'Chicken', 1750.00, 1),
('Party Pan Cordon Bleu', 'Chicken', 'Party Pan', 'Chicken', 2450.00, 1),
('Party Pan Ampalaya Con Carne', 'Veggies', 'Party Pan', 'Veggies', 1350.00, 1),
('Party Pan Ginataang Kalabasa', 'Veggies', 'Party Pan', 'Veggies', 1250.00, 1),
('Party Pan Chopsuey', 'Veggies', 'Party Pan', 'Veggies', 1250.00, 1),
('Party Pan Pinakbet', 'Veggies', 'Party Pan', 'Veggies', 1250.00, 1),
('Party Pan Calamares', 'Seafoods', 'Party Pan', 'Seafoods', 1180.00, 1),
('Party Pan Buttered Shrimp', 'Seafoods', 'Party Pan', 'Seafoods', 1950.00, 1),
('Party Pan Shrimp Tempura', 'Seafoods', 'Party Pan', 'Seafoods', 1900.00, 1),
('Party Pan Baked Tahong', 'Seafoods', 'Party Pan', 'Seafoods', 1750.00, 1),
('Party Pan Grilled Pusit', 'Seafoods', 'Party Pan', 'Seafoods', 1700.00, 1),
('Party Pan Fried Maliputo with Ensaladang Talong', 'Seafoods', 'Party Pan', 'Seafoods', 2800.00, 1),
('Party Pan Seafood Kare-Kare', 'Seafoods', 'Party Pan', 'Seafoods', 2830.00, 1),
('Party Pan Papa Es Kalderetang Baka', 'Beef', 'Party Pan', 'Beef', 1880.00, 1),
('Party Pan Clubhouse with Fries', 'Sandwich', 'Party Pan', 'Sandwich', 1100.00, 1),
('Party Pan Chicken Sandwich with Fries', 'Sandwich', 'Party Pan', 'Sandwich', 1100.00, 1),
('Party Pan Tuna Sandwich with Fries', 'Sandwich', 'Party Pan', 'Sandwich', 1100.00, 1);

-- 8. PIGING MEAL PACKAGES
INSERT INTO menu_items (item_name, category, parent_group, sub_category, sell_price, is_active) VALUES
('Piging 1 Package (4-6 pax)', 'Piging Package', 'Piging Meal', 'Packages', 2128.00, 1),
('Piging 2 Package (5-7 pax)', 'Piging Package', 'Piging Meal', 'Packages', 2768.00, 1),
('Piging 3 Package (8-10 pax)', 'Piging Package', 'Piging Meal', 'Packages', 4958.00, 1),
('Piging 4 Package (12-15 pax)', 'Piging Package', 'Piging Meal', 'Packages', 6168.00, 1),
('Piging 5 Package (15-20 pax)', 'Piging Package', 'Piging Meal', 'Packages', 9788.00, 1),
('Piging 6 Package (15-20 pax)', 'Piging Package', 'Piging Meal', 'Packages', 8388.00, 1);

-- 9. AUDIT TRAILS SEED
INSERT INTO audit_trails (user_id, action, entity_type, entity_id, details) VALUES
(1, 'SYSTEM_SEED', 'DATABASE', NULL, JSON_OBJECT('note', 'Initial sample data seeded'));

-- 10. RECIPES SEED (AGGREGATED TO PREVENT DUPLICATES)
INSERT INTO recipes (menu_item_id, ingredient_id, qty_required)
SELECT m.id, i.id, SUM(r.qty) AS qty_required
FROM (
  -- 1. MEDITERRANEAN
  SELECT 'Camaron Rebosado' AS item, 'Raw Shrimp' AS ing, 200.0000 AS qty UNION ALL
  SELECT 'Camaron Rebosado', 'Lemon Juice', 15.0000 UNION ALL
  SELECT 'Camaron Rebosado', 'Salt', 3.0000 UNION ALL
  SELECT 'Camaron Rebosado', 'Black Pepper', 1.0000 UNION ALL
  SELECT 'Camaron Rebosado', 'Flour', 60.0000 UNION ALL
  SELECT 'Camaron Rebosado', 'Cornstarch', 20.0000 UNION ALL
  SELECT 'Camaron Rebosado', 'Baking Powder', 2.0000 UNION ALL
  SELECT 'Camaron Rebosado', 'Egg', 1.0000 UNION ALL
  SELECT 'Camaron Rebosado', 'Cooking Oil', 40.0000 UNION ALL
  SELECT 'Camaron Rebosado', 'Sweet and Sour Sauce', 45.0000 UNION ALL

  SELECT 'Chicken Shawarma Delight with Fries', 'Raw Boneless Chicken', 150.0000 UNION ALL
  SELECT 'Chicken Shawarma Delight with Fries', 'Pita Bread', 1.0000 UNION ALL
  SELECT 'Chicken Shawarma Delight with Fries', 'Garlic White Sauce', 30.0000 UNION ALL
  SELECT 'Chicken Shawarma Delight with Fries', 'Lettuce', 30.0000 UNION ALL
  SELECT 'Chicken Shawarma Delight with Fries', 'Tomato', 30.0000 UNION ALL
  SELECT 'Chicken Shawarma Delight with Fries', 'Cucumber', 20.0000 UNION ALL
  SELECT 'Chicken Shawarma Delight with Fries', 'Frozen Fries', 100.0000 UNION ALL
  SELECT 'Chicken Shawarma Delight with Fries', 'Cooking Oil', 25.0000 UNION ALL
  SELECT 'Chicken Shawarma Delight with Fries', 'Shawarma Spices', 4.0000 UNION ALL
  SELECT 'Chicken Shawarma Delight with Fries', 'Salt', 2.0000 UNION ALL

  SELECT 'Pesto Pasta', 'Dry Pasta', 100.0000 UNION ALL
  SELECT 'Pesto Pasta', 'Basil Pesto', 45.0000 UNION ALL
  SELECT 'Pesto Pasta', 'Cooking Cream', 30.0000 UNION ALL
  SELECT 'Pesto Pasta', 'Olive Oil', 15.0000 UNION ALL
  SELECT 'Pesto Pasta', 'Garlic', 5.0000 UNION ALL
  SELECT 'Pesto Pasta', 'Parmesan Cheese', 15.0000 UNION ALL
  SELECT 'Pesto Pasta', 'Salt', 2.0000 UNION ALL
  SELECT 'Pesto Pasta', 'Black Pepper', 1.0000 UNION ALL

  SELECT 'Carbonara', 'Dry Pasta', 100.0000 UNION ALL
  SELECT 'Carbonara', 'Raw Bacon', 50.0000 UNION ALL
  SELECT 'Carbonara', 'Cooking Cream', 60.0000 UNION ALL
  SELECT 'Carbonara', 'Egg', 1.0000 UNION ALL
  SELECT 'Carbonara', 'Parmesan Cheese', 20.0000 UNION ALL
  SELECT 'Carbonara', 'Salt', 2.0000 UNION ALL
  SELECT 'Carbonara', 'Black Pepper', 1.0000 UNION ALL

  SELECT 'Margherita Pizza', 'Pizza Dough', 1.0000 UNION ALL
  SELECT 'Margherita Pizza', 'Pizza Sauce', 60.0000 UNION ALL
  SELECT 'Margherita Pizza', 'Mozzarella Cheese', 120.0000 UNION ALL
  SELECT 'Margherita Pizza', 'Fresh Basil', 5.0000 UNION ALL
  SELECT 'Margherita Pizza', 'Olive Oil', 10.0000 UNION ALL

  SELECT 'Marinara Pizza', 'Pizza Dough', 1.0000 UNION ALL
  SELECT 'Marinara Pizza', 'Marinara Sauce', 80.0000 UNION ALL
  SELECT 'Marinara Pizza', 'Garlic', 10.0000 UNION ALL
  SELECT 'Marinara Pizza', 'Dried Oregano', 2.0000 UNION ALL
  SELECT 'Marinara Pizza', 'Olive Oil', 15.0000 UNION ALL
  SELECT 'Marinara Pizza', 'Salt', 1.0000 UNION ALL

  -- 2. KOREAN
  SELECT 'Tteok-Bokki', 'Raw Rice Cakes', 200.0000 UNION ALL
  SELECT 'Tteok-Bokki', 'Fish Cakes', 50.0000 UNION ALL
  SELECT 'Tteok-Bokki', 'Gochujang', 30.0000 UNION ALL
  SELECT 'Tteok-Bokki', 'Gochugaru', 10.0000 UNION ALL
  SELECT 'Tteok-Bokki', 'Soy Sauce', 15.0000 UNION ALL
  SELECT 'Tteok-Bokki', 'Sugar', 15.0000 UNION ALL
  SELECT 'Tteok-Bokki', 'Garlic', 5.0000 UNION ALL
  SELECT 'Tteok-Bokki', 'Green Onion', 20.0000 UNION ALL
  SELECT 'Tteok-Bokki', 'Egg', 1.0000 UNION ALL

  SELECT 'Cheese Tteok-Bokki', 'Raw Rice Cakes', 200.0000 UNION ALL
  SELECT 'Cheese Tteok-Bokki', 'Fish Cakes', 50.0000 UNION ALL
  SELECT 'Cheese Tteok-Bokki', 'Mozzarella Cheese', 60.0000 UNION ALL
  SELECT 'Cheese Tteok-Bokki', 'Gochujang', 30.0000 UNION ALL
  SELECT 'Cheese Tteok-Bokki', 'Gochugaru', 10.0000 UNION ALL
  SELECT 'Cheese Tteok-Bokki', 'Soy Sauce', 15.0000 UNION ALL
  SELECT 'Cheese Tteok-Bokki', 'Sugar', 15.0000 UNION ALL
  SELECT 'Cheese Tteok-Bokki', 'Garlic', 5.0000 UNION ALL
  SELECT 'Cheese Tteok-Bokki', 'Green Onion', 20.0000 UNION ALL
  SELECT 'Cheese Tteok-Bokki', 'Egg', 1.0000 UNION ALL

  SELECT 'Kimbap / Gimbap', 'Seaweed Sheets', 1.0000 UNION ALL
  SELECT 'Kimbap / Gimbap', 'Raw Rice', 60.0000 UNION ALL
  SELECT 'Kimbap / Gimbap', 'Sesame Oil', 10.0000 UNION ALL
  SELECT 'Kimbap / Gimbap', 'Salt', 2.0000 UNION ALL
  SELECT 'Kimbap / Gimbap', 'Pickled Radish', 25.0000 UNION ALL
  SELECT 'Kimbap / Gimbap', 'Spam', 40.0000 UNION ALL
  SELECT 'Kimbap / Gimbap', 'Egg', 1.0000 UNION ALL
  SELECT 'Kimbap / Gimbap', 'Carrots', 30.0000 UNION ALL
  SELECT 'Kimbap / Gimbap', 'Spinach', 30.0000 UNION ALL

  SELECT 'Bibimbap', 'Raw Rice', 80.0000 UNION ALL
  SELECT 'Bibimbap', 'Raw Beef', 60.0000 UNION ALL
  SELECT 'Bibimbap', 'Egg', 1.0000 UNION ALL
  SELECT 'Bibimbap', 'Bean Sprouts', 30.0000 UNION ALL
  SELECT 'Bibimbap', 'Spinach', 30.0000 UNION ALL
  SELECT 'Bibimbap', 'Carrots', 30.0000 UNION ALL
  SELECT 'Bibimbap', 'Shiitake Mushrooms', 30.0000 UNION ALL
  SELECT 'Bibimbap', 'Zucchini', 30.0000 UNION ALL
  SELECT 'Bibimbap', 'Gochujang', 30.0000 UNION ALL
  SELECT 'Bibimbap', 'Sesame Oil', 10.0000 UNION ALL
  SELECT 'Bibimbap', 'Sesame Seeds', 2.0000 UNION ALL

  SELECT 'Kimchi Bokkeumbap', 'Raw Rice', 80.0000 UNION ALL
  SELECT 'Kimchi Bokkeumbap', 'Kimchi', 100.0000 UNION ALL
  SELECT 'Kimchi Bokkeumbap', 'Kimchi Juice', 30.0000 UNION ALL
  SELECT 'Kimchi Bokkeumbap', 'Spam', 40.0000 UNION ALL
  SELECT 'Kimchi Bokkeumbap', 'Gochujang', 10.0000 UNION ALL
  SELECT 'Kimchi Bokkeumbap', 'Soy Sauce', 10.0000 UNION ALL
  SELECT 'Kimchi Bokkeumbap', 'Sesame Oil', 10.0000 UNION ALL
  SELECT 'Kimchi Bokkeumbap', 'Cooking Oil', 15.0000 UNION ALL
  SELECT 'Kimchi Bokkeumbap', 'Egg', 1.0000 UNION ALL
  SELECT 'Kimchi Bokkeumbap', 'Seaweed Sheets', 1.0000 UNION ALL

  SELECT 'Osam-Bulgogi', 'Raw Squid', 150.0000 UNION ALL
  SELECT 'Osam-Bulgogi', 'Raw Pork Belly', 150.0000 UNION ALL
  SELECT 'Osam-Bulgogi', 'Onion', 50.0000 UNION ALL
  SELECT 'Osam-Bulgogi', 'Green Onion', 30.0000 UNION ALL
  SELECT 'Osam-Bulgogi', 'Gochujang', 30.0000 UNION ALL
  SELECT 'Osam-Bulgogi', 'Gochugaru', 15.0000 UNION ALL
  SELECT 'Osam-Bulgogi', 'Soy Sauce', 20.0000 UNION ALL
  SELECT 'Osam-Bulgogi', 'Sugar', 15.0000 UNION ALL
  SELECT 'Osam-Bulgogi', 'Garlic', 10.0000 UNION ALL
  SELECT 'Osam-Bulgogi', 'Sesame Oil', 10.0000 UNION ALL
  SELECT 'Osam-Bulgogi', 'Cooking Oil', 15.0000 UNION ALL

  SELECT 'Yangnyeom Chicken (whole)', 'Raw Chicken', 1000.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (whole)', 'Cornstarch', 120.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (whole)', 'Flour', 60.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (whole)', 'Korean Sweet and Spicy Sauce', 150.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (whole)', 'Cooking Oil', 100.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (whole)', 'Salt', 5.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (whole)', 'Black Pepper', 2.0000 UNION ALL

  SELECT 'Yangnyeom Chicken (half)', 'Raw Chicken', 500.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (half)', 'Cornstarch', 60.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (half)', 'Flour', 30.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (half)', 'Korean Sweet and Spicy Sauce', 75.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (half)', 'Cooking Oil', 50.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (half)', 'Salt', 3.0000 UNION ALL
  SELECT 'Yangnyeom Chicken (half)', 'Black Pepper', 1.0000 UNION ALL

  SELECT 'Soy Garlic Chicken (whole)', 'Raw Chicken', 1000.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (whole)', 'Cornstarch', 120.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (whole)', 'Flour', 60.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (whole)', 'Korean Soy Garlic Sauce', 150.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (whole)', 'Cooking Oil', 100.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (whole)', 'Salt', 5.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (whole)', 'Black Pepper', 2.0000 UNION ALL

  SELECT 'Soy Garlic Chicken (half)', 'Raw Chicken', 500.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (half)', 'Cornstarch', 60.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (half)', 'Flour', 30.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (half)', 'Korean Soy Garlic Sauce', 75.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (half)', 'Cooking Oil', 50.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (half)', 'Salt', 3.0000 UNION ALL
  SELECT 'Soy Garlic Chicken (half)', 'Black Pepper', 1.0000 UNION ALL

  SELECT 'Kimchi Jigae', 'Kimchi', 150.0000 UNION ALL
  SELECT 'Kimchi Jigae', 'Raw Pork Belly', 80.0000 UNION ALL
  SELECT 'Kimchi Jigae', 'Tofu', 80.0000 UNION ALL
  SELECT 'Kimchi Jigae', 'Gochugaru', 10.0000 UNION ALL
  SELECT 'Kimchi Jigae', 'Gochujang', 10.0000 UNION ALL
  SELECT 'Kimchi Jigae', 'Garlic', 10.0000 UNION ALL
  SELECT 'Kimchi Jigae', 'Soy Sauce', 15.0000 UNION ALL
  SELECT 'Kimchi Jigae', 'Green Onion', 20.0000 UNION ALL

  SELECT 'Galbitang', 'Raw Beef Ribs', 250.0000 UNION ALL
  SELECT 'Galbitang', 'Radish', 80.0000 UNION ALL
  SELECT 'Galbitang', 'Dry Glass Noodles', 30.0000 UNION ALL
  SELECT 'Galbitang', 'Garlic', 15.0000 UNION ALL
  SELECT 'Galbitang', 'Soy Sauce', 15.0000 UNION ALL
  SELECT 'Galbitang', 'Salt', 3.0000 UNION ALL
  SELECT 'Galbitang', 'Black Pepper', 1.0000 UNION ALL
  SELECT 'Galbitang', 'Green Onion', 20.0000 UNION ALL

  SELECT 'Budi Jigae Ramen', 'Ramen Noodles', 1.0000 UNION ALL
  SELECT 'Budi Jigae Ramen', 'Spam', 40.0000 UNION ALL
  SELECT 'Budi Jigae Ramen', 'Hotdog', 40.0000 UNION ALL
  SELECT 'Budi Jigae Ramen', 'Kimchi', 40.0000 UNION ALL
  SELECT 'Budi Jigae Ramen', 'Tofu', 40.0000 UNION ALL
  SELECT 'Budi Jigae Ramen', 'Baked Beans', 30.0000 UNION ALL
  SELECT 'Budi Jigae Ramen', 'Cheese Slice', 1.0000 UNION ALL
  SELECT 'Budi Jigae Ramen', 'Gochujang', 25.0000 UNION ALL
  SELECT 'Budi Jigae Ramen', 'Green Onion', 15.0000 UNION ALL

  SELECT 'Rabokki Ramen', 'Ramen Noodles', 1.0000 UNION ALL
  SELECT 'Rabokki Ramen', 'Raw Rice Cakes', 100.0000 UNION ALL
  SELECT 'Rabokki Ramen', 'Fish Cakes', 40.0000 UNION ALL
  SELECT 'Rabokki Ramen', 'Gochujang', 40.0000 UNION ALL
  SELECT 'Rabokki Ramen', 'Sugar', 10.0000 UNION ALL
  SELECT 'Rabokki Ramen', 'Egg', 1.0000 UNION ALL
  SELECT 'Rabokki Ramen', 'Green Onion', 15.0000 UNION ALL

  SELECT 'Japchae', 'Dry Glass Noodles', 100.0000 UNION ALL
  SELECT 'Japchae', 'Raw Beef', 50.0000 UNION ALL
  SELECT 'Japchae', 'Spinach', 30.0000 UNION ALL
  SELECT 'Japchae', 'Carrots', 30.0000 UNION ALL
  SELECT 'Japchae', 'Onion', 30.0000 UNION ALL
  SELECT 'Japchae', 'Shiitake Mushrooms', 30.0000 UNION ALL
  SELECT 'Japchae', 'Soy Sauce', 30.0000 UNION ALL
  SELECT 'Japchae', 'Sugar', 15.0000 UNION ALL
  SELECT 'Japchae', 'Sesame Oil', 20.0000 UNION ALL
  SELECT 'Japchae', 'Garlic', 5.0000 UNION ALL
  SELECT 'Japchae', 'Sesame Seeds', 3.0000 UNION ALL
  SELECT 'Japchae', 'Cooking Oil', 15.0000 UNION ALL

  -- 3. THE DINER (A LA CARTE)
  SELECT 'Calamares', 'Raw Squid', 250.0000 UNION ALL
  SELECT 'Calamares', 'Lemon Juice', 10.0000 UNION ALL
  SELECT 'Calamares', 'Flour', 50.0000 UNION ALL
  SELECT 'Calamares', 'Cornstarch', 30.0000 UNION ALL
  SELECT 'Calamares', 'Egg', 1.0000 UNION ALL
  SELECT 'Calamares', 'Salt', 3.0000 UNION ALL
  SELECT 'Calamares', 'Black Pepper', 1.0000 UNION ALL
  SELECT 'Calamares', 'Cooking Oil', 40.0000 UNION ALL
  SELECT 'Calamares', 'Tartar Sauce', 40.0000 UNION ALL

  SELECT 'Chicharon Bulaklak', 'Raw Pork Mesentery', 300.0000 UNION ALL
  SELECT 'Chicharon Bulaklak', 'Garlic', 10.0000 UNION ALL
  SELECT 'Chicharon Bulaklak', 'Bay Leaves', 2.0000 UNION ALL
  SELECT 'Chicharon Bulaklak', 'Whole Peppercorn', 2.0000 UNION ALL
  SELECT 'Chicharon Bulaklak', 'Salt', 5.0000 UNION ALL
  SELECT 'Chicharon Bulaklak', 'Cooking Oil', 50.0000 UNION ALL
  SELECT 'Chicharon Bulaklak', 'Spiced Vinegar', 40.0000 UNION ALL

  SELECT 'French Fries', 'Frozen Fries', 200.0000 UNION ALL
  SELECT 'French Fries', 'Salt', 3.0000 UNION ALL
  SELECT 'French Fries', 'Cooking Oil', 30.0000 UNION ALL
  SELECT 'French Fries', 'Ketchup', 30.0000 UNION ALL

  SELECT 'Shanghai Fingers', 'Raw Ground Pork', 200.0000 UNION ALL
  SELECT 'Shanghai Fingers', 'Carrots', 30.0000 UNION ALL
  SELECT 'Shanghai Fingers', 'Onion', 25.0000 UNION ALL
  SELECT 'Shanghai Fingers', 'Garlic', 10.0000 UNION ALL
  SELECT 'Shanghai Fingers', 'Egg', 1.0000 UNION ALL
  SELECT 'Shanghai Fingers', 'Salt', 3.0000 UNION ALL
  SELECT 'Shanghai Fingers', 'Black Pepper', 1.0000 UNION ALL
  SELECT 'Shanghai Fingers', 'Lumpia Wrapper', 8.0000 UNION ALL
  SELECT 'Shanghai Fingers', 'Cooking Oil', 40.0000 UNION ALL
  SELECT 'Shanghai Fingers', 'Sweet Chili Sauce', 40.0000 UNION ALL

  SELECT 'Teriyaki Shrimp', 'Raw Shrimp', 200.0000 UNION ALL
  SELECT 'Teriyaki Shrimp', 'Teriyaki Sauce', 50.0000 UNION ALL
  SELECT 'Teriyaki Shrimp', 'Garlic', 5.0000 UNION ALL
  SELECT 'Teriyaki Shrimp', 'Ginger', 3.0000 UNION ALL
  SELECT 'Teriyaki Shrimp', 'Butter', 15.0000 UNION ALL
  SELECT 'Teriyaki Shrimp', 'Sesame Seeds', 2.0000 UNION ALL
  SELECT 'Teriyaki Shrimp', 'Green Onion', 5.0000 UNION ALL

  SELECT 'Ampalaya Con Carne', 'Bitter Gourd', 150.0000 UNION ALL
  SELECT 'Ampalaya Con Carne', 'Raw Beef', 120.0000 UNION ALL
  SELECT 'Ampalaya Con Carne', 'Oyster Sauce', 20.0000 UNION ALL
  SELECT 'Ampalaya Con Carne', 'Soy Sauce', 15.0000 UNION ALL
  SELECT 'Ampalaya Con Carne', 'Garlic', 10.0000 UNION ALL
  SELECT 'Ampalaya Con Carne', 'Onion', 30.0000 UNION ALL
  SELECT 'Ampalaya Con Carne', 'Tomato', 30.0000 UNION ALL
  SELECT 'Ampalaya Con Carne', 'Cooking Oil', 15.0000 UNION ALL
  SELECT 'Ampalaya Con Carne', 'Cornstarch', 5.0000 UNION ALL

  SELECT 'Ginataang Kalabasa', 'Squash', 200.0000 UNION ALL
  SELECT 'Ginataang Kalabasa', 'String Beans', 80.0000 UNION ALL
  SELECT 'Ginataang Kalabasa', 'Raw Pork Belly', 60.0000 UNION ALL
  SELECT 'Ginataang Kalabasa', 'Coconut Milk', 200.0000 UNION ALL
  SELECT 'Ginataang Kalabasa', 'Garlic', 10.0000 UNION ALL
  SELECT 'Ginataang Kalabasa', 'Onion', 30.0000 UNION ALL
  SELECT 'Ginataang Kalabasa', 'Fish Sauce', 15.0000 UNION ALL
  SELECT 'Ginataang Kalabasa', 'Cooking Oil', 15.0000 UNION ALL

  SELECT 'Chopsuey', 'Cabbage', 100.0000 UNION ALL
  SELECT 'Chopsuey', 'Carrots', 50.0000 UNION ALL
  SELECT 'Chopsuey', 'Cauliflower', 50.0000 UNION ALL
  SELECT 'Chopsuey', 'Bell Pepper', 50.0000 UNION ALL
  SELECT 'Chopsuey', 'Raw Chicken', 80.0000 UNION ALL
  SELECT 'Chopsuey', 'Raw Chicken Liver', 40.0000 UNION ALL
  SELECT 'Chopsuey', 'Quail Eggs', 4.0000 UNION ALL
  SELECT 'Chopsuey', 'Oyster Sauce', 25.0000 UNION ALL
  SELECT 'Chopsuey', 'Soy Sauce', 10.0000 UNION ALL
  SELECT 'Chopsuey', 'Garlic', 10.0000 UNION ALL
  SELECT 'Chopsuey', 'Onion', 30.0000 UNION ALL
  SELECT 'Chopsuey', 'Cornstarch', 8.0000 UNION ALL
  SELECT 'Chopsuey', 'Cooking Oil', 15.0000 UNION ALL

  SELECT 'Pinakbet', 'Squash', 60.0000 UNION ALL
  SELECT 'Pinakbet', 'Eggplant', 60.0000 UNION ALL
  SELECT 'Pinakbet', 'Okra', 40.0000 UNION ALL
  SELECT 'Pinakbet', 'String Beans', 50.0000 UNION ALL
  SELECT 'Pinakbet', 'Bitter Gourd', 40.0000 UNION ALL
  SELECT 'Pinakbet', 'Raw Pork Belly', 80.0000 UNION ALL
  SELECT 'Pinakbet', 'Shrimp Paste', 30.0000 UNION ALL
  SELECT 'Pinakbet', 'Garlic', 10.0000 UNION ALL
  SELECT 'Pinakbet', 'Onion', 30.0000 UNION ALL
  SELECT 'Pinakbet', 'Tomato', 40.0000 UNION ALL
  SELECT 'Pinakbet', 'Cooking Oil', 15.0000 UNION ALL

  SELECT 'Ensaladang Talong', 'Eggplant', 200.0000 UNION ALL
  SELECT 'Ensaladang Talong', 'Tomato', 60.0000 UNION ALL
  SELECT 'Ensaladang Talong', 'Onion', 40.0000 UNION ALL
  SELECT 'Ensaladang Talong', 'Shrimp Paste', 30.0000 UNION ALL

  SELECT 'Crispy Pata Jumbo', 'Raw Pork Knuckle', 1300.0000 UNION ALL
  SELECT 'Crispy Pata Jumbo', 'Garlic', 20.0000 UNION ALL
  SELECT 'Crispy Pata Jumbo', 'Bay Leaves', 4.0000 UNION ALL
  SELECT 'Crispy Pata Jumbo', 'Whole Peppercorn', 5.0000 UNION ALL
  SELECT 'Crispy Pata Jumbo', 'Salt', 15.0000 UNION ALL
  SELECT 'Crispy Pata Jumbo', 'Cooking Oil', 100.0000 UNION ALL
  SELECT 'Crispy Pata Jumbo', 'Spiced Vinegar', 60.0000 UNION ALL

  SELECT 'Crispy Pata Super Jumbo', 'Raw Pork Knuckle', 1600.0000 UNION ALL
  SELECT 'Crispy Pata Super Jumbo', 'Garlic', 25.0000 UNION ALL
  SELECT 'Crispy Pata Super Jumbo', 'Bay Leaves', 5.0000 UNION ALL
  SELECT 'Crispy Pata Super Jumbo', 'Whole Peppercorn', 8.0000 UNION ALL
  SELECT 'Crispy Pata Super Jumbo', 'Salt', 20.0000 UNION ALL
  SELECT 'Crispy Pata Super Jumbo', 'Cooking Oil', 120.0000 UNION ALL
  SELECT 'Crispy Pata Super Jumbo', 'Spiced Vinegar', 80.0000 UNION ALL

  SELECT 'Crispy Pata Kare-Kare', 'Raw Pork Knuckle', 1000.0000 UNION ALL
  SELECT 'Crispy Pata Kare-Kare', 'Peanut Kare-Kare Sauce', 300.0000 UNION ALL
  SELECT 'Crispy Pata Kare-Kare', 'Eggplant', 60.0000 UNION ALL
  SELECT 'Crispy Pata Kare-Kare', 'String Beans', 50.0000 UNION ALL
  SELECT 'Crispy Pata Kare-Kare', 'Pechay', 50.0000 UNION ALL
  SELECT 'Crispy Pata Kare-Kare', 'Banana Blossom', 40.0000 UNION ALL
  SELECT 'Crispy Pata Kare-Kare', 'Shrimp Paste', 40.0000 UNION ALL
  SELECT 'Crispy Pata Kare-Kare', 'Cooking Oil', 80.0000 UNION ALL

  SELECT 'Papa Es Fried Chicken', 'Raw Chicken', 600.0000 UNION ALL
  SELECT 'Papa Es Fried Chicken', 'Chicken Marinade', 40.0000 UNION ALL
  SELECT 'Papa Es Fried Chicken', 'Chicken Breading', 100.0000 UNION ALL
  SELECT 'Papa Es Fried Chicken', 'Cooking Oil', 60.0000 UNION ALL
  SELECT 'Papa Es Fried Chicken', 'Gravy', 80.0000 UNION ALL

  SELECT 'Sizzling Chicken', 'Raw Boneless Chicken', 250.0000 UNION ALL
  SELECT 'Sizzling Chicken', 'Gravy', 60.0000 UNION ALL
  SELECT 'Sizzling Chicken', 'Butter', 15.0000 UNION ALL
  SELECT 'Sizzling Chicken', 'Garlic', 10.0000 UNION ALL
  SELECT 'Sizzling Chicken', 'Onion', 30.0000 UNION ALL
  SELECT 'Sizzling Chicken', 'Chili', 5.0000 UNION ALL

  SELECT 'Vanni\'s Chicken', 'Raw Chicken', 300.0000 UNION ALL
  SELECT 'Vanni\'s Chicken', 'Specialty Glaze', 60.0000 UNION ALL
  SELECT 'Vanni\'s Chicken', 'Garlic', 10.0000 UNION ALL
  SELECT 'Vanni\'s Chicken', 'Butter', 15.0000 UNION ALL
  SELECT 'Vanni\'s Chicken', 'Cooking Oil', 15.0000 UNION ALL

  SELECT 'Adobong Paiga na may sabaw na pahapyaw', 'Raw Chicken', 300.0000 UNION ALL
  SELECT 'Adobong Paiga na may sabaw na pahapyaw', 'Soy Sauce', 35.0000 UNION ALL
  SELECT 'Adobong Paiga na may sabaw na pahapyaw', 'Vinegar', 25.0000 UNION ALL
  SELECT 'Adobong Paiga na may sabaw na pahapyaw', 'Garlic', 15.0000 UNION ALL
  SELECT 'Adobong Paiga na may sabaw na pahapyaw', 'Bay Leaves', 2.0000 UNION ALL
  SELECT 'Adobong Paiga na may sabaw na pahapyaw', 'Whole Peppercorn', 2.0000 UNION ALL
  SELECT 'Adobong Paiga na may sabaw na pahapyaw', 'Sugar', 5.0000 UNION ALL
  SELECT 'Adobong Paiga na may sabaw na pahapyaw', 'Cooking Oil', 15.0000 UNION ALL

  SELECT 'Boneless Whole Chicken with Country Gravy', 'Raw Deboned Chicken', 1000.0000 UNION ALL
  SELECT 'Boneless Whole Chicken with Country Gravy', 'Chicken Breading', 120.0000 UNION ALL
  SELECT 'Boneless Whole Chicken with Country Gravy', 'Cooking Oil', 80.0000 UNION ALL
  SELECT 'Boneless Whole Chicken with Country Gravy', 'Country Gravy', 150.0000 UNION ALL

  SELECT 'Chicken Cordon Bleu', 'Raw Chicken Breast', 200.0000 UNION ALL
  SELECT 'Chicken Cordon Bleu', 'Ham', 50.0000 UNION ALL
  SELECT 'Chicken Cordon Bleu', 'Cheese Slice', 2.0000 UNION ALL
  SELECT 'Chicken Cordon Bleu', 'Flour', 30.0000 UNION ALL
  SELECT 'Chicken Cordon Bleu', 'Egg', 1.0000 UNION ALL
  SELECT 'Chicken Cordon Bleu', 'Breadcrumbs', 60.0000 UNION ALL
  SELECT 'Chicken Cordon Bleu', 'Cooking Oil', 40.0000 UNION ALL
  SELECT 'Chicken Cordon Bleu', 'White Cream Sauce', 50.0000 UNION ALL

  SELECT 'Batangas Bulalo', 'Raw Beef Shank', 600.0000 UNION ALL
  SELECT 'Batangas Bulalo', 'Sweet Corn', 100.0000 UNION ALL
  SELECT 'Batangas Bulalo', 'Pechay', 80.0000 UNION ALL
  SELECT 'Batangas Bulalo', 'Green Beans', 40.0000 UNION ALL
  SELECT 'Batangas Bulalo', 'Whole Peppercorn', 3.0000 UNION ALL
  SELECT 'Batangas Bulalo', 'Onion', 50.0000 UNION ALL
  SELECT 'Batangas Bulalo', 'Fish Sauce', 25.0000 UNION ALL

  SELECT 'Sinigang na Baboy', 'Raw Pork Belly', 250.0000 UNION ALL
  SELECT 'Sinigang na Baboy', 'Sinigang Mix', 25.0000 UNION ALL
  SELECT 'Sinigang na Baboy', 'Radish', 50.0000 UNION ALL
  SELECT 'Sinigang na Baboy', 'Eggplant', 50.0000 UNION ALL
  SELECT 'Sinigang na Baboy', 'String Beans', 40.0000 UNION ALL
  SELECT 'Sinigang na Baboy', 'Kangkong', 50.0000 UNION ALL
  SELECT 'Sinigang na Baboy', 'Tomato', 40.0000 UNION ALL
  SELECT 'Sinigang na Baboy', 'Onion', 30.0000 UNION ALL
  SELECT 'Sinigang na Baboy', 'Green Chili', 1.0000 UNION ALL

  SELECT 'Sinigang na Bangus', 'Raw Milkfish', 300.0000 UNION ALL
  SELECT 'Sinigang na Bangus', 'Sinigang Mix', 25.0000 UNION ALL
  SELECT 'Sinigang na Bangus', 'Radish', 50.0000 UNION ALL
  SELECT 'Sinigang na Bangus', 'Eggplant', 50.0000 UNION ALL
  SELECT 'Sinigang na Bangus', 'String Beans', 40.0000 UNION ALL
  SELECT 'Sinigang na Bangus', 'Kangkong', 50.0000 UNION ALL
  SELECT 'Sinigang na Bangus', 'Tomato', 40.0000 UNION ALL
  SELECT 'Sinigang na Bangus', 'Onion', 30.0000 UNION ALL
  SELECT 'Sinigang na Bangus', 'Green Chili', 1.0000 UNION ALL

  SELECT 'Sinigang na Hipon', 'Raw Shrimp', 250.0000 UNION ALL
  SELECT 'Sinigang na Hipon', 'Sinigang Mix', 25.0000 UNION ALL
  SELECT 'Sinigang na Hipon', 'Radish', 40.0000 UNION ALL
  SELECT 'Sinigang na Hipon', 'String Beans', 40.0000 UNION ALL
  SELECT 'Sinigang na Hipon', 'Kangkong', 50.0000 UNION ALL
  SELECT 'Sinigang na Hipon', 'Tomato', 40.0000 UNION ALL
  SELECT 'Sinigang na Hipon', 'Onion', 30.0000 UNION ALL
  SELECT 'Sinigang na Hipon', 'Green Chili', 1.0000 UNION ALL

  SELECT 'Sinigang na Salmon', 'Raw Salmon', 300.0000 UNION ALL
  SELECT 'Sinigang na Salmon', 'Sinigang Mix', 25.0000 UNION ALL
  SELECT 'Sinigang na Salmon', 'Radish', 50.0000 UNION ALL
  SELECT 'Sinigang na Salmon', 'Eggplant', 40.0000 UNION ALL
  SELECT 'Sinigang na Salmon', 'Kangkong', 50.0000 UNION ALL
  SELECT 'Sinigang na Salmon', 'Tomato', 40.0000 UNION ALL
  SELECT 'Sinigang na Salmon', 'Onion', 30.0000 UNION ALL
  SELECT 'Sinigang na Salmon', 'Green Chili', 1.0000 UNION ALL

  SELECT 'Sinigang na Maliputo', 'Raw Maliputo Fish', 350.0000 UNION ALL
  SELECT 'Sinigang na Maliputo', 'Sinigang Mix', 25.0000 UNION ALL
  SELECT 'Sinigang na Maliputo', 'Radish', 50.0000 UNION ALL
  SELECT 'Sinigang na Maliputo', 'String Beans', 40.0000 UNION ALL
  SELECT 'Sinigang na Maliputo', 'Kangkong', 50.0000 UNION ALL
  SELECT 'Sinigang na Maliputo', 'Tomato', 40.0000 UNION ALL
  SELECT 'Sinigang na Maliputo', 'Onion', 30.0000 UNION ALL
  SELECT 'Sinigang na Maliputo', 'Green Chili', 1.0000 UNION ALL

  SELECT 'Bagnet Kare-Kare', 'Raw Pork Belly', 250.0000 UNION ALL
  SELECT 'Bagnet Kare-Kare', 'Peanut Kare-Kare Sauce', 250.0000 UNION ALL
  SELECT 'Bagnet Kare-Kare', 'Eggplant', 50.0000 UNION ALL
  SELECT 'Bagnet Kare-Kare', 'String Beans', 40.0000 UNION ALL
  SELECT 'Bagnet Kare-Kare', 'Pechay', 40.0000 UNION ALL
  SELECT 'Bagnet Kare-Kare', 'Shrimp Paste', 30.0000 UNION ALL
  SELECT 'Bagnet Kare-Kare', 'Cooking Oil', 40.0000 UNION ALL

  SELECT 'Crispy Pork Dinakdakan', 'Raw Pork Belly', 250.0000 UNION ALL
  SELECT 'Crispy Pork Dinakdakan', 'Red Onion', 40.0000 UNION ALL
  SELECT 'Crispy Pork Dinakdakan', 'Ginger', 10.0000 UNION ALL
  SELECT 'Crispy Pork Dinakdakan', 'Chili', 10.0000 UNION ALL
  SELECT 'Crispy Pork Dinakdakan', 'Calamansi Juice', 15.0000 UNION ALL
  SELECT 'Crispy Pork Dinakdakan', 'Mayonnaise', 40.0000 UNION ALL
  SELECT 'Crispy Pork Dinakdakan', 'Salt', 2.0000 UNION ALL
  SELECT 'Crispy Pork Dinakdakan', 'Black Pepper', 1.0000 UNION ALL
  SELECT 'Crispy Pork Dinakdakan', 'Cooking Oil', 40.0000 UNION ALL

  SELECT 'Lechon Macau', 'Raw Pork Belly', 250.0000 UNION ALL
  SELECT 'Lechon Macau', 'Five Spice Seasoning', 3.0000 UNION ALL
  SELECT 'Lechon Macau', 'Salt', 5.0000 UNION ALL
  SELECT 'Lechon Macau', 'Cooking Oil', 50.0000 UNION ALL
  SELECT 'Lechon Macau', 'Lechon Sauce', 40.0000 UNION ALL

  SELECT 'Pork Binagoongan', 'Raw Pork Belly', 220.0000 UNION ALL
  SELECT 'Pork Binagoongan', 'Shrimp Paste', 40.0000 UNION ALL
  SELECT 'Pork Binagoongan', 'Tomato', 40.0000 UNION ALL
  SELECT 'Pork Binagoongan', 'Garlic', 10.0000 UNION ALL
  SELECT 'Pork Binagoongan', 'Onion', 30.0000 UNION ALL
  SELECT 'Pork Binagoongan', 'Eggplant', 50.0000 UNION ALL
  SELECT 'Pork Binagoongan', 'Chili', 5.0000 UNION ALL
  SELECT 'Pork Binagoongan', 'Cooking Oil', 15.0000 UNION ALL

  SELECT 'Crispy Pork Bicol Express', 'Raw Pork Belly', 220.0000 UNION ALL
  SELECT 'Crispy Pork Bicol Express', 'Coconut Milk', 180.0000 UNION ALL
  SELECT 'Crispy Pork Bicol Express', 'Shrimp Paste', 20.0000 UNION ALL
  SELECT 'Crispy Pork Bicol Express', 'Chili', 30.0000 UNION ALL
  SELECT 'Crispy Pork Bicol Express', 'Garlic', 10.0000 UNION ALL
  SELECT 'Crispy Pork Bicol Express', 'Onion', 30.0000 UNION ALL
  SELECT 'Crispy Pork Bicol Express', 'Cooking Oil', 15.0000 UNION ALL

  SELECT 'Pork Bistek', 'Raw Pork Loin', 220.0000 UNION ALL
  SELECT 'Pork Bistek', 'Soy Sauce', 35.0000 UNION ALL
  SELECT 'Pork Bistek', 'Calamansi Juice', 20.0000 UNION ALL
  SELECT 'Pork Bistek', 'Onion', 60.0000 UNION ALL
  SELECT 'Pork Bistek', 'Garlic', 10.0000 UNION ALL
  SELECT 'Pork Bistek', 'Black Pepper', 2.0000 UNION ALL
  SELECT 'Pork Bistek', 'Cooking Oil', 20.0000 UNION ALL

  SELECT 'Putchero', 'Raw Pork Shoulder', 250.0000 UNION ALL
  SELECT 'Putchero', 'Tomato Sauce', 100.0000 UNION ALL
  SELECT 'Putchero', 'Saba Banana', 1.0000 UNION ALL
  SELECT 'Putchero', 'Chickpeas', 30.0000 UNION ALL
  SELECT 'Putchero', 'Potato', 60.0000 UNION ALL
  SELECT 'Putchero', 'Cabbage', 60.0000 UNION ALL
  SELECT 'Putchero', 'Garlic', 10.0000 UNION ALL
  SELECT 'Putchero', 'Onion', 30.0000 UNION ALL

  SELECT 'Pork Adobo', 'Raw Pork Belly', 250.0000 UNION ALL
  SELECT 'Pork Adobo', 'Soy Sauce', 35.0000 UNION ALL
  SELECT 'Pork Adobo', 'Vinegar', 25.0000 UNION ALL
  SELECT 'Pork Adobo', 'Garlic', 15.0000 UNION ALL
  SELECT 'Pork Adobo', 'Bay Leaves', 2.0000 UNION ALL
  SELECT 'Pork Adobo', 'Whole Peppercorn', 2.0000 UNION ALL
  SELECT 'Pork Adobo', 'Sugar', 5.0000 UNION ALL
  SELECT 'Pork Adobo', 'Cooking Oil', 15.0000 UNION ALL

  SELECT 'Kalderetang Baka', 'Raw Beef', 250.0000 UNION ALL
  SELECT 'Kalderetang Baka', 'Tomato Sauce', 100.0000 UNION ALL
  SELECT 'Kalderetang Baka', 'Liver Spread', 40.0000 UNION ALL
  SELECT 'Kalderetang Baka', 'Potato', 50.0000 UNION ALL
  SELECT 'Kalderetang Baka', 'Carrots', 50.0000 UNION ALL
  SELECT 'Kalderetang Baka', 'Bell Pepper', 30.0000 UNION ALL
  SELECT 'Kalderetang Baka', 'Cheese', 20.0000 UNION ALL
  SELECT 'Kalderetang Baka', 'Garlic', 10.0000 UNION ALL
  SELECT 'Kalderetang Baka', 'Onion', 30.0000 UNION ALL
  SELECT 'Kalderetang Baka', 'Cooking Oil', 15.0000 UNION ALL

  SELECT 'Buttered Shrimp', 'Raw Shrimp', 220.0000 UNION ALL
  SELECT 'Buttered Shrimp', 'Butter', 40.0000 UNION ALL
  SELECT 'Buttered Shrimp', 'Garlic', 15.0000 UNION ALL
  SELECT 'Buttered Shrimp', 'Sprite', 40.0000 UNION ALL
  SELECT 'Buttered Shrimp', 'Salt', 1.0000 UNION ALL
  SELECT 'Buttered Shrimp', 'Black Pepper', 1.0000 UNION ALL

  SELECT 'Baked Tahong', 'Raw Green Mussels', 300.0000 UNION ALL
  SELECT 'Baked Tahong', 'Butter', 30.0000 UNION ALL
  SELECT 'Baked Tahong', 'Garlic', 15.0000 UNION ALL
  SELECT 'Baked Tahong', 'Cheese', 60.0000 UNION ALL

  SELECT 'Shrimp Tempura', 'Raw Shrimp', 180.0000 UNION ALL
  SELECT 'Shrimp Tempura', 'Tempura Batter Mix', 60.0000 UNION ALL
  SELECT 'Shrimp Tempura', 'Cooking Oil', 40.0000 UNION ALL
  SELECT 'Shrimp Tempura', 'Tempura Sauce', 40.0000 UNION ALL

  SELECT 'Fried Maliputo with ensaladang talong', 'Raw Maliputo Fish', 350.0000 UNION ALL
  SELECT 'Fried Maliputo with ensaladang talong', 'Eggplant', 100.0000 UNION ALL
  SELECT 'Fried Maliputo with ensaladang talong', 'Tomato', 40.0000 UNION ALL
  SELECT 'Fried Maliputo with ensaladang talong', 'Onion', 30.0000 UNION ALL
  SELECT 'Fried Maliputo with ensaladang talong', 'Shrimp Paste', 25.0000 UNION ALL
  SELECT 'Fried Maliputo with ensaladang talong', 'Cooking Oil', 60.0000 UNION ALL

  SELECT 'Seafood Kare-Kare', 'Raw Shrimp', 80.0000 UNION ALL
  SELECT 'Seafood Kare-Kare', 'Raw Squid', 80.0000 UNION ALL
  SELECT 'Seafood Kare-Kare', 'Raw Green Mussels', 90.0000 UNION ALL
  SELECT 'Seafood Kare-Kare', 'Peanut Kare-Kare Sauce', 250.0000 UNION ALL
  SELECT 'Seafood Kare-Kare', 'Eggplant', 50.0000 UNION ALL
  SELECT 'Seafood Kare-Kare', 'String Beans', 40.0000 UNION ALL
  SELECT 'Seafood Kare-Kare', 'Pechay', 40.0000 UNION ALL
  SELECT 'Seafood Kare-Kare', 'Shrimp Paste', 30.0000 UNION ALL

  SELECT 'Grilled Liempo', 'Raw Pork Belly', 250.0000 UNION ALL
  SELECT 'Grilled Liempo', 'BBQ Marinade', 50.0000 UNION ALL
  SELECT 'Grilled Liempo', 'Calamansi Juice', 10.0000 UNION ALL
  SELECT 'Grilled Liempo', 'Soy Sauce', 15.0000 UNION ALL
  SELECT 'Grilled Liempo', 'Garlic', 5.0000 UNION ALL

  SELECT 'Inihaw na Pusit', 'Raw Squid', 250.0000 UNION ALL
  SELECT 'Inihaw na Pusit', 'Tomato', 40.0000 UNION ALL
  SELECT 'Inihaw na Pusit', 'Onion', 30.0000 UNION ALL
  SELECT 'Inihaw na Pusit', 'Ginger', 5.0000 UNION ALL
  SELECT 'Inihaw na Pusit', 'Soy Sauce', 20.0000 UNION ALL
  SELECT 'Inihaw na Pusit', 'Calamansi Juice', 10.0000 UNION ALL

  SELECT 'Papa Es Sisig', 'Raw Pork Maskara', 150.0000 UNION ALL
  SELECT 'Papa Es Sisig', 'Raw Pork Belly', 50.0000 UNION ALL
  SELECT 'Papa Es Sisig', 'Raw Chicken Liver', 30.0000 UNION ALL
  SELECT 'Papa Es Sisig', 'Onion', 40.0000 UNION ALL
  SELECT 'Papa Es Sisig', 'Chili', 10.0000 UNION ALL
  SELECT 'Papa Es Sisig', 'Calamansi Juice', 15.0000 UNION ALL
  SELECT 'Papa Es Sisig', 'Egg', 1.0000 UNION ALL
  SELECT 'Papa Es Sisig', 'Mayonnaise', 20.0000 UNION ALL
  SELECT 'Papa Es Sisig', 'Butter', 10.0000 UNION ALL

  SELECT 'Sizzling Bangus', 'Raw Milkfish', 220.0000 UNION ALL
  SELECT 'Sizzling Bangus', 'Onion', 40.0000 UNION ALL
  SELECT 'Sizzling Bangus', 'Garlic', 10.0000 UNION ALL
  SELECT 'Sizzling Bangus', 'Chili', 10.0000 UNION ALL
  SELECT 'Sizzling Bangus', 'Calamansi Juice', 15.0000 UNION ALL
  SELECT 'Sizzling Bangus', 'Butter', 15.0000 UNION ALL
  SELECT 'Sizzling Bangus', 'Soy Sauce', 15.0000 UNION ALL

  SELECT 'Sizzling Seafood', 'Raw Squid', 60.0000 UNION ALL
  SELECT 'Sizzling Seafood', 'Raw Shrimp', 60.0000 UNION ALL
  SELECT 'Sizzling Seafood', 'Raw Green Mussels', 60.0000 UNION ALL
  SELECT 'Sizzling Seafood', 'Raw Fish Fillet', 40.0000 UNION ALL
  SELECT 'Sizzling Seafood', 'Butter', 20.0000 UNION ALL
  SELECT 'Sizzling Seafood', 'Garlic', 10.0000 UNION ALL
  SELECT 'Sizzling Seafood', 'Onion', 30.0000 UNION ALL
  SELECT 'Sizzling Seafood', 'Bell Pepper', 20.0000 UNION ALL
  SELECT 'Sizzling Seafood', 'Oyster Sauce', 40.0000 UNION ALL
  SELECT 'Sizzling Seafood', 'Chili', 5.0000 UNION ALL

  -- 4. THE DINER (RICE, SANDWICHES, PANSIT, DRINKS, DESSERT)
  SELECT 'Plain Rice Platter', 'Raw Rice', 320.0000 UNION ALL

  SELECT 'Garlic Rice Platter', 'Raw Rice', 320.0000 UNION ALL
  SELECT 'Garlic Rice Platter', 'Garlic', 40.0000 UNION ALL
  SELECT 'Garlic Rice Platter', 'Cooking Oil', 30.0000 UNION ALL
  SELECT 'Garlic Rice Platter', 'Salt', 4.0000 UNION ALL

  SELECT 'Yang Chao Rice Platter', 'Raw Rice', 320.0000 UNION ALL
  SELECT 'Yang Chao Rice Platter', 'Raw Pork Belly', 80.0000 UNION ALL
  SELECT 'Yang Chao Rice Platter', 'Raw Shrimp', 60.0000 UNION ALL
  SELECT 'Yang Chao Rice Platter', 'Egg', 2.0000 UNION ALL
  SELECT 'Yang Chao Rice Platter', 'Frozen Mixed Veggies', 60.0000 UNION ALL
  SELECT 'Yang Chao Rice Platter', 'Green Onion', 20.0000 UNION ALL
  SELECT 'Yang Chao Rice Platter', 'Soy Sauce', 25.0000 UNION ALL
  SELECT 'Yang Chao Rice Platter', 'Cooking Oil', 30.0000 UNION ALL

  SELECT 'Seafood Rice Platter', 'Raw Rice', 320.0000 UNION ALL
  SELECT 'Seafood Rice Platter', 'Raw Squid', 60.0000 UNION ALL
  SELECT 'Seafood Rice Platter', 'Raw Shrimp', 60.0000 UNION ALL
  SELECT 'Seafood Rice Platter', 'Raw Fish Fillet', 50.0000 UNION ALL
  SELECT 'Seafood Rice Platter', 'Garlic', 15.0000 UNION ALL
  SELECT 'Seafood Rice Platter', 'Onion', 15.0000 UNION ALL
  SELECT 'Seafood Rice Platter', 'Oyster Sauce', 30.0000 UNION ALL
  SELECT 'Seafood Rice Platter', 'Cooking Oil', 30.0000 UNION ALL
  SELECT 'Seafood Rice Platter', 'Green Onion', 15.0000 UNION ALL

  SELECT 'Bagoong Rice', 'Raw Rice', 320.0000 UNION ALL
  SELECT 'Bagoong Rice', 'Shrimp Paste', 80.0000 UNION ALL
  SELECT 'Bagoong Rice', 'Raw Pork Belly', 80.0000 UNION ALL
  SELECT 'Bagoong Rice', 'Egg', 1.0000 UNION ALL
  SELECT 'Bagoong Rice', 'Green Mango', 60.0000 UNION ALL
  SELECT 'Bagoong Rice', 'Tomato', 40.0000 UNION ALL
  SELECT 'Bagoong Rice', 'Onion', 30.0000 UNION ALL
  SELECT 'Bagoong Rice', 'Cooking Oil', 20.0000 UNION ALL

  SELECT 'Plain Rice (Solo)', 'Raw Rice', 75.0000 UNION ALL

  SELECT 'Chicken Sandwich with Fries', 'Burger Bun', 1.0000 UNION ALL
  SELECT 'Chicken Sandwich with Fries', 'Raw Chicken', 100.0000 UNION ALL
  SELECT 'Chicken Sandwich with Fries', 'Mayonnaise', 30.0000 UNION ALL
  SELECT 'Chicken Sandwich with Fries', 'Lettuce', 15.0000 UNION ALL
  SELECT 'Chicken Sandwich with Fries', 'Tomato', 20.0000 UNION ALL
  SELECT 'Chicken Sandwich with Fries', 'Cucumber', 15.0000 UNION ALL
  SELECT 'Chicken Sandwich with Fries', 'Frozen Fries', 80.0000 UNION ALL
  SELECT 'Chicken Sandwich with Fries', 'Cooking Oil', 20.0000 UNION ALL

  SELECT 'Clubhouse Sandwich with Fries', 'Sliced Bread', 3.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Ham', 40.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Raw Chicken', 50.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Cheese Slice', 1.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Egg', 1.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Raw Bacon', 20.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Mayonnaise', 30.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Lettuce', 15.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Tomato', 20.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Cucumber', 15.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Frozen Fries', 80.0000 UNION ALL
  SELECT 'Clubhouse Sandwich with Fries', 'Cooking Oil', 20.0000 UNION ALL

  SELECT 'Tuna Sandwich with Fries', 'Sliced Bread', 2.0000 UNION ALL
  SELECT 'Tuna Sandwich with Fries', 'Canned Tuna', 90.0000 UNION ALL
  SELECT 'Tuna Sandwich with Fries', 'Mayonnaise', 30.0000 UNION ALL
  SELECT 'Tuna Sandwich with Fries', 'Onion', 15.0000 UNION ALL
  SELECT 'Tuna Sandwich with Fries', 'Salt', 1.0000 UNION ALL
  SELECT 'Tuna Sandwich with Fries', 'Black Pepper', 1.0000 UNION ALL
  SELECT 'Tuna Sandwich with Fries', 'Lettuce', 15.0000 UNION ALL
  SELECT 'Tuna Sandwich with Fries', 'Tomato', 20.0000 UNION ALL
  SELECT 'Tuna Sandwich with Fries', 'Frozen Fries', 80.0000 UNION ALL
  SELECT 'Tuna Sandwich with Fries', 'Cooking Oil', 20.0000 UNION ALL

  SELECT 'Canton / Bihon Mixed', 'Dry Pancit Canton', 100.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Dry Pancit Bihon', 100.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Raw Pork Shoulder', 60.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Raw Chicken Liver', 30.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Fishballs', 40.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Cabbage', 60.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Carrots', 30.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'String Beans', 30.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Soy Sauce', 25.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Oyster Sauce', 15.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Garlic', 10.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Onion', 10.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Cooking Oil', 20.0000 UNION ALL
  SELECT 'Canton / Bihon Mixed', 'Calamansi', 2.0000 UNION ALL

  SELECT 'Canton / Sotanghon Mixed', 'Dry Pancit Canton', 100.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Dry Sotanghon', 100.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Raw Chicken', 80.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Fishballs', 40.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Wood Ear Mushroom', 10.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Cabbage', 60.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Carrots', 60.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Soy Sauce', 25.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Oyster Sauce', 15.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Garlic', 10.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Onion', 10.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Cooking Oil', 20.0000 UNION ALL
  SELECT 'Canton / Sotanghon Mixed', 'Calamansi', 2.0000 UNION ALL

  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Dry Mixed Noodles', 400.0000 UNION ALL
  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Raw Pork Shoulder', 80.0000 UNION ALL
  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Raw Chicken', 70.0000 UNION ALL
  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Fishballs', 80.0000 UNION ALL
  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Cabbage', 150.0000 UNION ALL
  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Carrots', 100.0000 UNION ALL
  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Soy Sauce', 60.0000 UNION ALL
  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Oyster Sauce', 40.0000 UNION ALL
  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Egg', 2.0000 UNION ALL
  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Calamansi', 6.0000 UNION ALL
  SELECT 'Pansit sa Bilao Small (4 - 6 pax)', 'Bilao Tray', 1.0000 UNION ALL

  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Dry Mixed Noodles', 700.0000 UNION ALL
  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Raw Pork Shoulder', 130.0000 UNION ALL
  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Raw Chicken', 120.0000 UNION ALL
  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Fishballs', 150.0000 UNION ALL
  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Cabbage', 250.0000 UNION ALL
  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Carrots', 150.0000 UNION ALL
  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Soy Sauce', 100.0000 UNION ALL
  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Oyster Sauce', 60.0000 UNION ALL
  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Egg', 4.0000 UNION ALL
  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Calamansi', 10.0000 UNION ALL
  SELECT 'Pansit sa Bilao Medium (8 - 10 pax)', 'Bilao Tray', 1.0000 UNION ALL

  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Dry Mixed Noodles', 1000.0000 UNION ALL
  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Raw Pork Shoulder', 180.0000 UNION ALL
  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Raw Chicken', 170.0000 UNION ALL
  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Fishballs', 200.0000 UNION ALL
  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Cabbage', 350.0000 UNION ALL
  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Carrots', 250.0000 UNION ALL
  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Soy Sauce', 140.0000 UNION ALL
  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Oyster Sauce', 80.0000 UNION ALL
  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Egg', 6.0000 UNION ALL
  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Calamansi', 15.0000 UNION ALL
  SELECT 'Pansit sa Bilao Large (12 - 15 pax)', 'Bilao Tray', 1.0000 UNION ALL

  SELECT 'Kamayan Meat', 'Raw Rice', 400.0000 UNION ALL
  SELECT 'Kamayan Meat', 'Raw Pork Belly', 300.0000 UNION ALL
  SELECT 'Kamayan Meat', 'Raw Chicken', 400.0000 UNION ALL
  SELECT 'Kamayan Meat', 'Raw Pork Skewers', 6.0000 UNION ALL
  SELECT 'Kamayan Meat', 'Lumpia', 8.0000 UNION ALL
  SELECT 'Kamayan Meat', 'Eggplant', 200.0000 UNION ALL
  SELECT 'Kamayan Meat', 'Salted Egg', 2.0000 UNION ALL
  SELECT 'Kamayan Meat', 'Tomato', 100.0000 UNION ALL
  SELECT 'Kamayan Meat', 'Banana Leaf', 1.0000 UNION ALL

  SELECT 'Kamayan Seafood', 'Raw Rice', 400.0000 UNION ALL
  SELECT 'Kamayan Seafood', 'Raw Shrimp', 300.0000 UNION ALL
  SELECT 'Kamayan Seafood', 'Raw Squid', 300.0000 UNION ALL
  SELECT 'Kamayan Seafood', 'Raw practical Mussels', 300.0000 UNION ALL
  SELECT 'Kamayan Seafood', 'Raw Green Mussels', 300.0000 UNION ALL
  SELECT 'Kamayan Seafood', 'Raw Maliputo Fish', 350.0000 UNION ALL
  SELECT 'Kamayan Seafood', 'Eggplant', 200.0000 UNION ALL
  SELECT 'Kamayan Seafood', 'Salted Egg', 2.0000 UNION ALL
  SELECT 'Kamayan Seafood', 'Tomato', 100.0000 UNION ALL
  SELECT 'Kamayan Seafood', 'Banana Leaf', 1.0000 UNION ALL

  SELECT 'Kamayan Mixed', 'Raw Rice', 700.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Raw Pork Belly', 400.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Raw Chicken', 500.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Raw Pork Skewers', 10.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Raw Shrimp', 350.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Raw Squid', 350.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Raw Green Mussels', 350.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Lumpia', 12.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Eggplant', 300.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Salted Egg', 4.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Tomato', 200.0000 UNION ALL
  SELECT 'Kamayan Mixed', 'Banana Leaf', 2.0000 UNION ALL

  SELECT 'Kamayan sa Bilao', 'Raw Rice', 320.0000 UNION ALL
  SELECT 'Kamayan sa Bilao', 'Raw Pork Belly', 250.0000 UNION ALL
  SELECT 'Kamayan sa Bilao', 'Raw Chicken', 300.0000 UNION ALL
  SELECT 'Kamayan sa Bilao', 'Raw Shrimp', 200.0000 UNION ALL
  SELECT 'Kamayan sa Bilao', 'Raw Squid', 200.0000 UNION ALL
  SELECT 'Kamayan sa Bilao', 'Eggplant', 150.0000 UNION ALL
  SELECT 'Kamayan sa Bilao', 'Salted Egg', 2.0000 UNION ALL
  SELECT 'Kamayan sa Bilao', 'Tomato', 80.0000 UNION ALL
  SELECT 'Kamayan sa Bilao', 'Bilao Tray', 1.0000 UNION ALL
  SELECT 'Kamayan sa Bilao', 'Banana Leaf', 1.0000 UNION ALL

  SELECT 'Leche Flan', 'Egg', 8.0000 UNION ALL
  SELECT 'Leche Flan', 'Condensed Milk', 300.0000 UNION ALL
  SELECT 'Leche Flan', 'Evaporated Milk', 250.0000 UNION ALL
  SELECT 'Leche Flan', 'Sugar', 80.0000 UNION ALL
  SELECT 'Leche Flan', 'Vanilla Extract', 5.0000 UNION ALL

  SELECT 'Cucumber Lemonade Pitcher', 'Cucumber Lemonade Powder', 120.0000 UNION ALL
  SELECT 'Cucumber Lemonade Pitcher', 'Cucumber', 60.0000 UNION ALL
  SELECT 'Cucumber Lemonade Pitcher', 'Lemon', 40.0000 UNION ALL

  SELECT 'Ice Tea Lemonade Pitcher', 'Iced Tea Powder', 120.0000 UNION ALL
  SELECT 'Ice Tea Lemonade Pitcher', 'Lemon', 40.0000 UNION ALL

  SELECT 'Cucumber Lemonade Single', 'Cucumber Lemonade Powder', 35.0000 UNION ALL
  SELECT 'Cucumber Lemonade Single', 'Cucumber', 15.0000 UNION ALL

  SELECT 'Ice Tea Lemonade Single', 'Iced Tea Powder', 35.0000 UNION ALL
  SELECT 'Ice Tea Lemonade Single', 'Lemon', 10.0000 UNION ALL

  SELECT 'San Mig Light', 'San Mig Light Bottle', 1.0000 UNION ALL
  SELECT 'San Mig Apple', 'San Mig Apple Bottle', 1.0000 UNION ALL
  SELECT 'Red Horse Stallion', 'Red Horse Bottle', 1.0000 UNION ALL
  SELECT 'Coke Zero Can', 'Coke Zero Can', 1.0000 UNION ALL
  SELECT 'Royal Can', 'Royal Can', 1.0000 UNION ALL
  SELECT 'Sprite Can', 'Sprite Can', 1.0000 UNION ALL
  SELECT 'Pineapple Can', 'Pineapple Juice Can', 1.0000 UNION ALL

  -- 5. PARTY PAN
  SELECT 'Party Pan Bagnet Kare-Kare', 'Raw Pork Belly', 1200.0000 UNION ALL
  SELECT 'Party Pan Bagnet Kare-Kare', 'Peanut Kare-Kare Sauce', 1000.0000 UNION ALL
  SELECT 'Party Pan Bagnet Kare-Kare', 'Eggplant', 250.0000 UNION ALL
  SELECT 'Party Pan Bagnet Kare-Kare', 'String Beans', 200.0000 UNION ALL
  SELECT 'Party Pan Bagnet Kare-Kare', 'Pechay', 200.0000 UNION ALL
  SELECT 'Party Pan Bagnet Kare-Kare', 'Shrimp Paste', 150.0000 UNION ALL
  SELECT 'Party Pan Bagnet Kare-Kare', 'Cooking Oil', 150.0000 UNION ALL
  SELECT 'Party Pan Bagnet Kare-Kare', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Crispy Pork Bicol Express', 'Raw Pork Belly', 1200.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Bicol Express', 'Coconut Milk', 900.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Bicol Express', 'Shrimp Paste', 100.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Bicol Express', 'Chili', 150.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Bicol Express', 'Garlic', 50.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Bicol Express', 'Onion', 100.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Bicol Express', 'Cooking Oil', 100.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Bicol Express', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Crispy Pork Dinakdakan', 'Raw Pork Belly', 1300.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Dinakdakan', 'Red Onion', 200.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Dinakdakan', 'Ginger', 50.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Dinakdakan', 'Chili', 50.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Dinakdakan', 'Calamansi Juice', 80.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Dinakdakan', 'Mayonnaise', 200.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Dinakdakan', 'Salt', 10.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Dinakdakan', 'Black Pepper', 5.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Dinakdakan', 'Cooking Oil', 150.0000 UNION ALL
  SELECT 'Party Pan Crispy Pork Dinakdakan', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Lechon Macau', 'Raw Pork Belly', 1400.0000 UNION ALL
  SELECT 'Party Pan Lechon Macau', 'Five Spice Seasoning', 15.0000 UNION ALL
  SELECT 'Party Pan Lechon Macau', 'Salt', 25.0000 UNION ALL
  SELECT 'Party Pan Lechon Macau', 'Lechon Sauce', 200.0000 UNION ALL
  SELECT 'Party Pan Lechon Macau', 'Cooking Oil', 150.0000 UNION ALL
  SELECT 'Party Pan Lechon Macau', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Pork Binagoongan', 'Raw Pork Belly', 1200.0000 UNION ALL
  SELECT 'Party Pan Pork Binagoongan', 'Shrimp Paste', 200.0000 UNION ALL
  SELECT 'Party Pan Pork Binagoongan', 'Tomato', 200.0000 UNION ALL
  SELECT 'Party Pan Pork Binagoongan', 'Garlic', 50.0000 UNION ALL
  SELECT 'Party Pan Pork Binagoongan', 'Onion', 100.0000 UNION ALL
  SELECT 'Party Pan Pork Binagoongan', 'Eggplant', 250.0000 UNION ALL
  SELECT 'Party Pan Pork Binagoongan', 'Chili', 25.0000 UNION ALL
  SELECT 'Party Pan Pork Binagoongan', 'Cooking Oil', 50.0000 UNION ALL
  SELECT 'Party Pan Pork Binagoongan', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Papa Es Pork Sisig', 'Raw Pork Maskara', 800.0000 UNION ALL
  SELECT 'Party Pan Papa Es Pork Sisig', 'Raw Pork Belly', 300.0000 UNION ALL
  SELECT 'Party Pan Papa Es Pork Sisig', 'Raw Chicken Liver', 150.0000 UNION ALL
  SELECT 'Party Pan Papa Es Pork Sisig', 'Onion', 200.0000 UNION ALL
  SELECT 'Party Pan Papa Es Pork Sisig', 'Chili', 50.0000 UNION ALL
  SELECT 'Party Pan Papa Es Pork Sisig', 'Calamansi Juice', 80.0000 UNION ALL
  SELECT 'Party Pan Papa Es Pork Sisig', 'Mayonnaise', 100.0000 UNION ALL
  SELECT 'Party Pan Papa Es Pork Sisig', 'Butter', 50.0000 UNION ALL
  SELECT 'Party Pan Papa Es Pork Sisig', 'Egg', 3.0000 UNION ALL
  SELECT 'Party Pan Papa Es Pork Sisig', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Chicharon Bulaklak', 'Raw Pork Mesentery', 1500.0000 UNION ALL
  SELECT 'Party Pan Chicharon Bulaklak', 'Garlic', 50.0000 UNION ALL
  SELECT 'Party Pan Chicharon Bulaklak', 'Bay Leaves', 8.0000 UNION ALL
  SELECT 'Party Pan Chicharon Bulaklak', 'Whole Peppercorn', 10.0000 UNION ALL
  SELECT 'Party Pan Chicharon Bulaklak', 'Salt', 25.0000 UNION ALL
  SELECT 'Party Pan Chicharon Bulaklak', 'Cooking Oil', 250.0000 UNION ALL
  SELECT 'Party Pan Chicharon Bulaklak', 'Spiced Vinegar', 200.0000 UNION ALL
  SELECT 'Party Pan Chicharon Bulaklak', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Shanghai Fingers', 'Lumpia', 40.0000 UNION ALL
  SELECT 'Party Pan Shanghai Fingers', 'Cooking Oil', 150.0000 UNION ALL
  SELECT 'Party Pan Shanghai Fingers', 'Sweet Chili Sauce', 200.0000 UNION ALL
  SELECT 'Party Pan Shanghai Fingers', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Pork Bistek', 'Raw Pork Loin', 1200.0000 UNION ALL
  SELECT 'Party Pan Pork Bistek', 'Soy Sauce', 180.0000 UNION ALL
  SELECT 'Party Pan Pork Bistek', 'Calamansi Juice', 100.0000 UNION ALL
  SELECT 'Party Pan Pork Bistek', 'Onion', 300.0000 UNION ALL
  SELECT 'Party Pan Pork Bistek', 'Garlic', 50.0000 UNION ALL
  SELECT 'Party Pan Pork Bistek', 'Black Pepper', 10.0000 UNION ALL
  SELECT 'Party Pan Pork Bistek', 'Cooking Oil', 80.0000 UNION ALL
  SELECT 'Party Pan Pork Bistek', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Pork Adobo', 'Raw Pork Belly', 1300.0000 UNION ALL
  SELECT 'Party Pan Pork Adobo', 'Soy Sauce', 180.0000 UNION ALL
  SELECT 'Party Pan Pork Adobo', 'Vinegar', 120.0000 UNION ALL
  SELECT 'Party Pan Pork Adobo', 'Garlic', 80.0000 UNION ALL
  SELECT 'Party Pan Pork Adobo', 'Bay Leaves', 8.0000 UNION ALL
  SELECT 'Party Pan Pork Adobo', 'Whole Peppercorn', 10.0000 UNION ALL
  SELECT 'Party Pan Pork Adobo', 'Sugar', 25.0000 UNION ALL
  SELECT 'Party Pan Pork Adobo', 'Cooking Oil', 60.0000 UNION ALL
  SELECT 'Party Pan Pork Adobo', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Putchero', 'Raw Pork Shoulder', 1300.0000 UNION ALL
  SELECT 'Party Pan Putchero', 'Tomato Sauce', 500.0000 UNION ALL
  SELECT 'Party Pan Putchero', 'Saba Banana', 5.0000 UNION ALL
  SELECT 'Party Pan Putchero', 'Chickpeas', 150.0000 UNION ALL
  SELECT 'Party Pan Putchero', 'Potato', 300.0000 UNION ALL
  SELECT 'Party Pan Putchero', 'Cabbage', 300.0000 UNION ALL
  SELECT 'Party Pan Putchero', 'Garlic', 50.0000 UNION ALL
  SELECT 'Party Pan Putchero', 'Onion', 100.0000 UNION ALL
  SELECT 'Party Pan Putchero', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Papa Es Fried Chicken', 'Raw Chicken', 2000.0000 UNION ALL
  SELECT 'Party Pan Papa Es Fried Chicken', 'Chicken Marinade', 150.0000 UNION ALL
  SELECT 'Party Pan Papa Es Fried Chicken', 'Chicken Breading', 350.0000 UNION ALL
  SELECT 'Party Pan Papa Es Fried Chicken', 'Cooking Oil', 250.0000 UNION ALL
  SELECT 'Party Pan Papa Es Fried Chicken', 'Gravy', 350.0000 UNION ALL
  SELECT 'Party Pan Papa Es Fried Chicken', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Boneless Whole Chicken with Country Gravy', 'Raw Deboned Chicken', 2000.0000 UNION ALL
  SELECT 'Party Pan Boneless Whole Chicken with Country Gravy', 'Chicken Breading', 350.0000 UNION ALL
  SELECT 'Party Pan Boneless Whole Chicken with Country Gravy', 'Cooking Oil', 250.0000 UNION ALL
  SELECT 'Party Pan Boneless Whole Chicken with Country Gravy', 'Country Gravy', 400.0000 UNION ALL
  SELECT 'Party Pan Boneless Whole Chicken with Country Gravy', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Vanni\'s Chicken', 'Raw Chicken', 1800.0000 UNION ALL
  SELECT 'Party Pan Vanni\'s Chicken', 'Specialty Glaze', 300.0000 UNION ALL
  SELECT 'Party Pan Vanni\'s Chicken', 'Garlic', 30.0000 UNION ALL
  SELECT 'Party Pan Vanni\'s Chicken', 'Cooking Oil', 150.0000 UNION ALL
  SELECT 'Party Pan Vanni\'s Chicken', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Adobong Paiga', 'Raw Chicken', 1500.0000 UNION ALL
  SELECT 'Party Pan Adobong Paiga', 'Soy Sauce', 180.0000 UNION ALL
  SELECT 'Party Pan Adobong Paiga', 'Vinegar', 120.0000 UNION ALL
  SELECT 'Party Pan Adobong Paiga', 'Garlic', 80.0000 UNION ALL
  SELECT 'Party Pan Adobong Paiga', 'Bay Leaves', 8.0000 UNION ALL
  SELECT 'Party Pan Adobong Paiga', 'Whole Peppercorn', 10.0000 UNION ALL
  SELECT 'Party Pan Adobong Paiga', 'Sugar', 25.0000 UNION ALL
  SELECT 'Party Pan Adobong Paiga', 'Cooking Oil', 60.0000 UNION ALL
  SELECT 'Party Pan Adobong Paiga', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Cordon Bleu', 'Raw Chicken Breast', 1000.0000 UNION ALL
  SELECT 'Party Pan Cordon Bleu', 'Ham', 250.0000 UNION ALL
  SELECT 'Party Pan Cordon Bleu', 'Cheese Slice', 10.0000 UNION ALL
  SELECT 'Party Pan Cordon Bleu', 'Flour', 150.0000 UNION ALL
  SELECT 'Party Pan Cordon Bleu', 'Egg', 4.0000 UNION ALL
  SELECT 'Party Pan Cordon Bleu', 'Breadcrumbs', 300.0000 UNION ALL
  SELECT 'Party Pan Cordon Bleu', 'Cooking Oil', 180.0000 UNION ALL
  SELECT 'Party Pan Cordon Bleu', 'White Cream Sauce', 300.0000 UNION ALL
  SELECT 'Party Pan Cordon Bleu', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Ampalaya Con Carne', 'Bitter Gourd', 700.0000 UNION ALL
  SELECT 'Party Pan Ampalaya Con Carne', 'Raw Beef', 600.0000 UNION ALL
  SELECT 'Party Pan Ampalaya Con Carne', 'Oyster Sauce', 100.0000 UNION ALL
  SELECT 'Party Pan Ampalaya Con Carne', 'Soy Sauce', 75.0000 UNION ALL
  SELECT 'Party Pan Ampalaya Con Carne', 'Tomato', 150.0000 UNION ALL
  SELECT 'Party Pan Ampalaya Con Carne', 'Onion', 100.0000 UNION ALL
  SELECT 'Party Pan Ampalaya Con Carne', 'Garlic', 50.0000 UNION ALL
  SELECT 'Party Pan Ampalaya Con Carne', 'Cornstarch', 25.0000 UNION ALL
  SELECT 'Party Pan Ampalaya Con Carne', 'Cooking Oil', 60.0000 UNION ALL
  SELECT 'Party Pan Ampalaya Con Carne', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Ginataang Kalabasa', 'Squash', 900.0000 UNION ALL
  SELECT 'Party Pan Ginataang Kalabasa', 'String Beans', 400.0000 UNION ALL
  SELECT 'Party Pan Ginataang Kalabasa', 'Raw Pork Belly', 300.0000 UNION ALL
  SELECT 'Party Pan Ginataang Kalabasa', 'Coconut Milk', 900.0000 UNION ALL
  SELECT 'Party Pan Ginataang Kalabasa', 'Garlic', 50.0000 UNION ALL
  SELECT 'Party Pan Ginataang Kalabasa', 'Onion', 100.0000 UNION ALL
  SELECT 'Party Pan Ginataang Kalabasa', 'Fish Sauce', 60.0000 UNION ALL
  SELECT 'Party Pan Ginataang Kalabasa', 'Cooking Oil', 50.0000 UNION ALL
  SELECT 'Party Pan Ginataang Kalabasa', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Chopsuey', 'Cabbage', 500.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Carrots', 250.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Cauliflower', 250.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Bell Pepper', 200.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Raw Chicken', 400.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Raw Chicken Liver', 200.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Quail Eggs', 20.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Oyster Sauce', 120.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Soy Sauce', 50.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Garlic', 50.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Onion', 100.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Cornstarch', 40.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Cooking Oil', 60.0000 UNION ALL
  SELECT 'Party Pan Chopsuey', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Pinakbet', 'Squash', 300.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'Eggplant', 300.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'Okra', 200.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'String Beans', 250.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'Bitter Gourd', 150.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'Raw Pork Belly', 400.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'Shrimp Paste', 150.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'Tomato', 200.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'Garlic', 50.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'Onion', 100.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'Cooking Oil', 60.0000 UNION ALL
  SELECT 'Party Pan Pinakbet', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Calamares', 'Raw Squid', 1200.0000 UNION ALL
  SELECT 'Party Pan Calamares', 'Lemon Juice', 50.0000 UNION ALL
  SELECT 'Party Pan Calamares', 'Flour', 200.0000 UNION ALL
  SELECT 'Party Pan Calamares', 'Cornstarch', 100.0000 UNION ALL
  SELECT 'Party Pan Calamares', 'Egg', 3.0000 UNION ALL
  SELECT 'Party Pan Calamares', 'Cooking Oil', 200.0000 UNION ALL
  SELECT 'Party Pan Calamares', 'Tartar Sauce', 250.0000 UNION ALL
  SELECT 'Party Pan Calamares', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Buttered Shrimp', 'Raw Shrimp', 1100.0000 UNION ALL
  SELECT 'Party Pan Buttered Shrimp', 'Butter', 200.0000 UNION ALL
  SELECT 'Party Pan Buttered Shrimp', 'Garlic', 80.0000 UNION ALL
  SELECT 'Party Pan Buttered Shrimp', 'Sprite', 200.0000 UNION ALL
  SELECT 'Party Pan Buttered Shrimp', 'Salt', 5.0000 UNION ALL
  SELECT 'Party Pan Buttered Shrimp', 'Black Pepper', 5.0000 UNION ALL
  SELECT 'Party Pan Buttered Shrimp', 'Green Onion', 25.0000 UNION ALL
  SELECT 'Party Pan Buttered Shrimp', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Shrimp Tempura', 'Raw Shrimp', 750.0000 UNION ALL
  SELECT 'Party Pan Shrimp Tempura', 'Tempura Batter Mix', 250.0000 UNION ALL
  SELECT 'Party Pan Shrimp Tempura', 'Cooking Oil', 200.0000 UNION ALL
  SELECT 'Party Pan Shrimp Tempura', 'Tempura Sauce', 250.0000 UNION ALL
  SELECT 'Party Pan Shrimp Tempura', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Baked Tahong', 'Raw Green Mussels', 1500.0000 UNION ALL
  SELECT 'Party Pan Baked Tahong', 'Butter', 150.0000 UNION ALL
  SELECT 'Party Pan Baked Tahong', 'Garlic', 80.0000 UNION ALL
  SELECT 'Party Pan Baked Tahong', 'Cheese', 300.0000 UNION ALL
  SELECT 'Party Pan Baked Tahong', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Grilled Pusit', 'Raw Squid', 1200.0000 UNION ALL
  SELECT 'Party Pan Grilled Pusit', 'Tomato', 200.0000 UNION ALL
  SELECT 'Party Pan Grilled Pusit', 'Onion', 150.0000 UNION ALL
  SELECT 'Party Pan Grilled Pusit', 'Soy Sauce', 100.0000 UNION ALL
  SELECT 'Party Pan Grilled Pusit', 'Calamansi Juice', 50.0000 UNION ALL
  SELECT 'Party Pan Grilled Pusit', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Fried Maliputo with Ensaladang Talong', 'Raw Maliputo Fish', 1400.0000 UNION ALL
  SELECT 'Party Pan Fried Maliputo with Ensaladang Talong', 'Cooking Oil', 250.0000 UNION ALL
  SELECT 'Party Pan Fried Maliputo with Ensaladang Talong', 'Eggplant', 400.0000 UNION ALL
  SELECT 'Party Pan Fried Maliputo with Ensaladang Talong', 'Tomato', 150.0000 UNION ALL
  SELECT 'Party Pan Fried Maliputo with Ensaladang Talong', 'Onion', 100.0000 UNION ALL
  SELECT 'Party Pan Fried Maliputo with Ensaladang Talong', 'Shrimp Paste', 100.0000 UNION ALL
  SELECT 'Party Pan Fried Maliputo with Ensaladang Talong', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Seafood Kare-Kare', 'Raw Shrimp', 400.0000 UNION ALL
  SELECT 'Party Pan Seafood Kare-Kare', 'Raw Squid', 400.0000 UNION ALL
  SELECT 'Party Pan Seafood Kare-Kare', 'Raw Green Mussels', 400.0000 UNION ALL
  SELECT 'Party Pan Seafood Kare-Kare', 'Peanut Kare-Kare Sauce', 1000.0000 UNION ALL
  SELECT 'Party Pan Seafood Kare-Kare', 'Eggplant', 250.0000 UNION ALL
  SELECT 'Party Pan Seafood Kare-Kare', 'String Beans', 200.0000 UNION ALL
  SELECT 'Party Pan Seafood Kare-Kare', 'Pechay', 200.0000 UNION ALL
  SELECT 'Party Pan Seafood Kare-Kare', 'Shrimp Paste', 150.0000 UNION ALL
  SELECT 'Party Pan Seafood Kare-Kare', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Raw Beef', 1200.0000 UNION ALL
  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Tomato Sauce', 500.0000 UNION ALL
  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Liver Spread', 180.0000 UNION ALL
  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Potato', 250.0000 UNION ALL
  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Carrots', 250.0000 UNION ALL
  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Bell Pepper', 150.0000 UNION ALL
  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Cheese', 100.0000 UNION ALL
  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Garlic', 50.0000 UNION ALL
  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Onion', 100.0000 UNION ALL
  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Cooking Oil', 60.0000 UNION ALL
  SELECT 'Party Pan Papa Es Kalderetang Baka', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Clubhouse with Fries', 'Sliced Bread', 24.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Ham', 300.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Raw Chicken', 400.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Cheese Slice', 8.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Egg', 8.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Raw Bacon', 160.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Mayonnaise', 250.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Lettuce', 150.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Tomato', 150.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Cucumber', 100.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Frozen Fries', 500.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Cooking Oil', 100.0000 UNION ALL
  SELECT 'Party Pan Clubhouse with Fries', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Chicken Sandwich with Fries', 'Burger Bun', 8.0000 UNION ALL
  SELECT 'Party Pan Chicken Sandwich with Fries', 'Raw Chicken', 800.0000 UNION ALL
  SELECT 'Party Pan Chicken Sandwich with Fries', 'Mayonnaise', 250.0000 UNION ALL
  SELECT 'Party Pan Chicken Sandwich with Fries', 'Lettuce', 150.0000 UNION ALL
  SELECT 'Party Pan Chicken Sandwich with Fries', 'Tomato', 150.0000 UNION ALL
  SELECT 'Party Pan Chicken Sandwich with Fries', 'Cucumber', 100.0000 UNION ALL
  SELECT 'Party Pan Chicken Sandwich with Fries', 'Frozen Fries', 500.0000 UNION ALL
  SELECT 'Party Pan Chicken Sandwich with Fries', 'Cooking Oil', 100.0000 UNION ALL
  SELECT 'Party Pan Chicken Sandwich with Fries', 'Party Pan Container', 1.0000 UNION ALL

  SELECT 'Party Pan Tuna Sandwich with Fries', 'Sliced Bread', 16.0000 UNION ALL
  SELECT 'Party Pan Tuna Sandwich with Fries', 'Canned Tuna', 700.0000 UNION ALL
  SELECT 'Party Pan Tuna Sandwich with Fries', 'Mayonnaise', 250.0000 UNION ALL
  SELECT 'Party Pan Tuna Sandwich with Fries', 'Onion', 120.0000 UNION ALL
  SELECT 'Party Pan Tuna Sandwich with Fries', 'Lettuce', 150.0000 UNION ALL
  SELECT 'Party Pan Tuna Sandwich with Fries', 'Tomato', 150.0000 UNION ALL
  SELECT 'Party Pan Tuna Sandwich with Fries', 'Frozen Fries', 500.0000 UNION ALL
  SELECT 'Party Pan Tuna Sandwich with Fries', 'Cooking Oil', 100.0000 UNION ALL
  SELECT 'Party Pan Tuna Sandwich with Fries', 'Party Pan Container', 1.0000 UNION ALL

  -- 6. PIGING MEALS
  SELECT 'Piging 1 Package (4-6 pax)', 'Raw Chicken', 750.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Chicken Breading', 120.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Cooking Oil', 100.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Gravy', 100.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Raw Pork Maskara', 200.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Raw Pork Belly', 100.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Raw Chicken Liver', 40.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Cabbage', 150.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Carrots', 75.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Cauliflower', 75.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Bell Pepper', 50.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Raw Rice', 320.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Cucumber Lemonade Powder', 120.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Condensed Milk', 300.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Evaporated Milk', 250.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Egg', 8.0000 UNION ALL
  SELECT 'Piging 1 Package (4-6 pax)', 'Sugar', 80.0000 UNION ALL

  SELECT 'Piging 2 Package (5-7 pax)', 'Raw Pork Knuckle', 1300.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Cooking Oil', 120.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Spiced Vinegar', 60.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Raw Pork Belly', 250.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Sinigang Mix', 25.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Radish', 50.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Eggplant', 50.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'String Beans', 40.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Kangkong', 50.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Tomato', 40.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Onion', 30.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Green Chili', 1.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Dry Pancit Canton', 100.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Dry Pancit Bihon', 100.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Raw Pork Shoulder', 60.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Fishballs', 40.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Cabbage', 60.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Carrots', 40.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Raw Rice', 400.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Iced Tea Powder', 120.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Condensed Milk', 300.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Evaporated Milk', 250.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Egg', 8.0000 UNION ALL
  SELECT 'Piging 2 Package (5-7 pax)', 'Sugar', 80.0000 UNION ALL

  SELECT 'Piging 3 Package (8-10 pax)', 'Raw Pork Knuckle', 1600.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Cooking Oil', 150.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Spiced Vinegar', 80.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Raw Beef', 500.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Tomato Sauce', 200.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Liver Spread', 80.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Potato', 100.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Carrots', 100.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Bell Pepper', 60.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Cheese', 40.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Raw Shrimp', 400.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Butter', 80.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Garlic', 30.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Sprite', 80.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Dry Mixed Noodles', 700.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Raw Pork Shoulder', 130.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Raw Chicken', 120.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Fishballs', 150.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Cabbage', 250.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Carrots', 150.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Bilao Tray', 1.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Raw Rice', 600.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Cucumber Lemonade Powder', 240.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Condensed Milk', 600.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Evaporated Milk', 500.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Egg', 16.0000 UNION ALL
  SELECT 'Piging 3 Package (8-10 pax)', 'Sugar', 160.0000 UNION ALL

  SELECT 'Piging 4 Package (12-15 pax)', 'Raw Pork Knuckle', 1600.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Cooking Oil', 180.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Spiced Vinegar', 80.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Raw Beef Shank', 600.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Sweet Corn', 100.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Pechay', 80.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Green Beans', 40.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Raw Pork Belly', 600.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Peanut Kare-Kare Sauce', 600.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Eggplant', 150.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'String Beans', 100.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Shrimp Paste', 80.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Raw Chicken', 1500.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Chicken Breading', 250.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Gravy', 200.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Dry Mixed Noodles', 1000.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Raw Pork Shoulder', 180.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Raw Chicken', 170.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Fishballs', 200.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Cabbage', 350.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Carrots', 250.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Bilao Tray', 1.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Raw Rice', 900.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Iced Tea Powder', 360.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Condensed Milk', 600.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Evaporated Milk', 500.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Egg', 16.0000 UNION ALL
  SELECT 'Piging 4 Package (12-15 pax)', 'Sugar', 160.0000 UNION ALL

  SELECT 'Piging 5 Package (15-20 pax)', 'Raw Pork Knuckle', 3200.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Cooking Oil', 300.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Spiced Vinegar', 160.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Raw Beef Shank', 1200.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Sweet Corn', 200.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Pechay', 160.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Green Beans', 80.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Raw Shrimp', 250.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Raw Squid', 250.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Raw Green Mussels', 300.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Peanut Kare-Kare Sauce', 800.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Eggplant', 200.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'String Beans', 150.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Shrimp Paste', 100.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Raw Deboned Chicken', 2000.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Chicken Breading', 350.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Country Gravy', 400.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Lumpia', 30.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Sweet Chili Sauce', 150.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Dry Mixed Noodles', 1000.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Raw Pork Shoulder', 180.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Raw Chicken', 170.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Fishballs', 200.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Cabbage', 350.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Carrots', 250.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Bilao Tray', 1.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Raw Rice', 1200.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Cucumber Lemonade Powder', 480.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Condensed Milk', 900.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Evaporated Milk', 750.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Egg', 24.0000 UNION ALL
  SELECT 'Piging 5 Package (15-20 pax)', 'Sugar', 240.0000 UNION ALL

  SELECT 'Piging 6 Package (15-20 pax)', 'Raw Pork Knuckle', 3200.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Cooking Oil', 300.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Spiced Vinegar', 160.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Raw Maliputo Fish', 700.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Sinigang Mix', 50.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Radish', 100.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'String Beans', 80.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Kangkong', 100.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Tomato', 80.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Onion', 60.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Raw Beef', 800.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Tomato Sauce', 350.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Liver Spread', 120.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Potato', 150.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Carrots', 150.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Bell Pepper', 100.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Cheese', 60.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Raw Shrimp', 700.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Butter', 140.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Garlic', 50.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Sprite', 140.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Raw Pork Maskara', 500.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Raw Pork Belly', 250.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Raw Chicken Liver', 100.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Chili', 40.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Mayonnaise', 80.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Dry Mixed Noodles', 1000.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Raw Pork Shoulder', 180.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Raw Chicken', 170.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Fishballs', 200.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Cabbage', 350.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Carrots', 250.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Bilao Tray', 1.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Raw Rice', 1200.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Iced Tea Powder', 480.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Condensed Milk', 900.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Evaporated Milk', 750.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Egg', 24.0000 UNION ALL
  SELECT 'Piging 6 Package (15-20 pax)', 'Sugar', 240.0000
) r
JOIN menu_items m ON m.item_name = r.item
JOIN ingredients i ON i.ingredient_name = r.ing
GROUP BY m.id, i.id;
