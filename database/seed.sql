INSERT INTO categories (name, emoji, sort_order, is_visible)
VALUES
  ('ÕLU', '🍺', 1, TRUE),
  ('SÖÖK JA NÄKS', '🍟', 2, TRUE),
  ('KANGE ALKOHOL', '🥃', 3, TRUE),
  ('KRAADITA JOOK', '🥤', 4, TRUE),
  ('REPART', '⚙️', 5, TRUE),
  ('MUU LAHJA', '🍏', 6, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO products (category_id, name, price, stock_quantity, is_visible, is_inventory_tracked, sort_order)
SELECT c.id, x.name, x.price, x.stock_quantity, TRUE, x.is_inventory_tracked, x.sort_order
FROM (
  VALUES
    ('ÕLU', 'Premium', 1.40, 0, TRUE, 1),
    ('ÕLU', 'Premium Purk 0.33L', 1.00, 0, TRUE, 2),
    ('ÕLU', 'Pilsner', 1.20, 0, TRUE, 3),
    ('ÕLU', 'Warsteiner', 1.80, 0, TRUE, 4),
    ('SÖÖK JA NÄKS', 'Tupla', 1.30, 0, TRUE, 1),
    ('SÖÖK JA NÄKS', 'Kismet', 1.20, 0, TRUE, 2),
    ('KANGE ALKOHOL', 'Viin', 0.40, 0, TRUE, 1),
    ('KRAADITA JOOK', 'Limonaad', 0.80, 0, TRUE, 1),
    ('REPART', 'EtteMaks', -1.00, 0, FALSE, 1),
    ('MUU LAHJA', 'Karksi Õunasiider', 1.60, 0, TRUE, 1)
) AS x(category_name, name, price, stock_quantity, is_inventory_tracked, sort_order)
JOIN categories c ON c.name = x.category_name
WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE p.name = x.name
);

INSERT INTO people (first_name, last_name, coetus, konvent, is_visible, sort_order)
VALUES
  ('Rander Erich', 'Pikkani', '2025/I', 'Vironia', TRUE, 1),
  ('Hans Robert', 'Kannukene', '2025/I', 'Vironia', TRUE, 2),
  ('Georg', 'Markov', '2025/I', 'Vironia', TRUE, 3),
  ('Oliver', 'Olup', '2024/II', 'Vironia', TRUE, 4)
ON CONFLICT DO NOTHING;
