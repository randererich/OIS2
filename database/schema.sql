CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  coetus TEXT,
  konvent TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'tk',
  stock_quantity INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_inventory_tracked BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id),
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity <> 0),
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id),
  quantity_change INT NOT NULL CHECK (quantity_change <> 0),
  reason TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_count_reports (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valvevarv TEXT,
  comment TEXT
);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'tk';

UPDATE products p
SET unit = 'cl'
FROM categories c
WHERE p.category_id = c.id
  AND c.name = 'KANGE ALKOHOL'
  AND p.unit <> 'cl';

ALTER TABLE inventory_count_reports
ADD COLUMN IF NOT EXISTS valvevarv TEXT;

UPDATE inventory_count_reports
SET valvevarv = 'Määramata'
WHERE valvevarv IS NULL;

ALTER TABLE inventory_count_reports
ALTER COLUMN valvevarv SET NOT NULL;

CREATE TABLE IF NOT EXISTS inventory_counts (
  id SERIAL PRIMARY KEY,
  report_id INT,
  product_id INT NOT NULL REFERENCES products(id),
  expected_quantity INT NOT NULL,
  counted_quantity INT NOT NULL,
  difference INT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventory_counts
ADD COLUMN IF NOT EXISTS report_id INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_counts_report_id_fkey'
  ) THEN
    ALTER TABLE inventory_counts
    ADD CONSTRAINT inventory_counts_report_id_fkey
    FOREIGN KEY (report_id)
    REFERENCES inventory_count_reports(id)
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$
DECLARE
  fallback_report_id INT;
BEGIN
  IF EXISTS (SELECT 1 FROM inventory_counts WHERE report_id IS NULL) THEN
    INSERT INTO inventory_count_reports (comment)
    VALUES ('Auto-generated migration report for legacy inventory counts')
    RETURNING id INTO fallback_report_id;

    UPDATE inventory_counts
    SET report_id = fallback_report_id
    WHERE report_id IS NULL;
  END IF;

  ALTER TABLE inventory_counts
  ALTER COLUMN report_id SET NOT NULL;
END $$;

DROP VIEW IF EXISTS person_debts;

CREATE VIEW person_debts AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.coetus,
  p.konvent,
  COALESCE(purchases.total, 0) - COALESCE(payments.total, 0) AS debt
FROM people p
LEFT JOIN (
  SELECT person_id, SUM(total_price) AS total
  FROM purchases
  WHERE is_cancelled = FALSE
  GROUP BY person_id
) purchases ON purchases.person_id = p.id
LEFT JOIN (
  SELECT person_id, SUM(amount) AS total
  FROM payments
  GROUP BY person_id
) payments ON payments.person_id = p.id;

CREATE INDEX IF NOT EXISTS idx_people_visible_sort ON people (is_visible, sort_order, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_categories_visible_sort ON categories (is_visible, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_products_category_sort ON products (category_id, is_visible, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_purchases_person ON purchases (person_id, is_cancelled);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases (product_id, is_cancelled);
CREATE INDEX IF NOT EXISTS idx_payments_person ON payments (person_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases (created_at, is_cancelled);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_report ON inventory_counts (report_id);
