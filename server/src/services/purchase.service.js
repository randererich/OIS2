import { transaction } from "../db.js";

const CASH_ACCOUNT_FIRST_NAME = "Sula";
const CASH_ACCOUNT_LAST_NAME = "Raha";

export async function ensureCashSetup() {
  await transaction(async (client) => {
    await ensureDecimalQuantityColumns(client);
    await client.query(
      "ALTER TABLE purchases ADD COLUMN IF NOT EXISTS affects_debt BOOLEAN NOT NULL DEFAULT TRUE"
    );

    await client.query(
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'tk'"
    );

    await client.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_name = 'inventory_count_reports'
         ) THEN
           ALTER TABLE inventory_count_reports
           ADD COLUMN IF NOT EXISTS cash_counted NUMERIC(10,2) NOT NULL DEFAULT 0;
         END IF;
       END $$`
    );

    await client.query(
      `UPDATE categories
       SET name = 'Sularaha',
           emoji = '💶'
       WHERE name IN ('REPART', '🪙 REPART 🪙')`
    );

    await client.query(
      `INSERT INTO categories (name, emoji, sort_order, is_visible)
       SELECT 'Sularaha', '💶', 5, TRUE
       WHERE NOT EXISTS (
         SELECT 1 FROM categories WHERE name = 'Sularaha'
       )`
    );

    await client.query(
      `WITH cash_category AS (
         SELECT id
         FROM categories
         WHERE name = 'Sularaha'
         ORDER BY sort_order ASC, id ASC
         LIMIT 1
       )
       UPDATE products
       SET is_visible = FALSE
       WHERE name IN ('Muu repart', 'EtteMaks')
         AND category_id = (SELECT id FROM cash_category)`
    );

    await client.query(
      `WITH cash_category AS (
         SELECT id
         FROM categories
         WHERE name = 'Sularaha'
         ORDER BY sort_order ASC, id ASC
         LIMIT 1
       )
       INSERT INTO products (category_id, name, price, stock_quantity, unit, is_visible, is_inventory_tracked, sort_order)
       SELECT cash_category.id, x.name, 1.00, 0, 'tk', TRUE, FALSE, x.sort_order
       FROM cash_category
       CROSS JOIN (
         VALUES
           ('Sissemakse', 1),
           ('Väljamakse', 2)
       ) AS x(name, sort_order)
       WHERE NOT EXISTS (
         SELECT 1
         FROM products p
         WHERE p.category_id = cash_category.id
           AND p.name = x.name
       )`
    );

    await ensureCashAccount(client);
    await ensurePersonDebtsView(client);
  });
}

async function ensurePersonDebtsView(client) {
  await client.query(
    `CREATE OR REPLACE VIEW person_debts AS
     SELECT
       p.id,
       p.first_name,
       p.last_name,
       p.coetus,
       p.konvent,
       COALESCE(purchases.total, 0) +
         CASE
           WHEN lower(p.first_name) = lower('Sula')
            AND lower(p.last_name) = lower('Raha')
           THEN COALESCE(payments.total, 0)
           ELSE -COALESCE(payments.total, 0)
         END AS debt
     FROM people p
     LEFT JOIN (
       SELECT person_id, SUM(total_price) AS total
       FROM purchases
       WHERE is_cancelled = FALSE
         AND affects_debt = TRUE
       GROUP BY person_id
     ) purchases ON purchases.person_id = p.id
     LEFT JOIN (
       SELECT person_id, SUM(amount) AS total
       FROM payments
       GROUP BY person_id
     ) payments ON payments.person_id = p.id`
  );
}

async function ensureDecimalQuantityColumns(client) {
  const columns = [
    ["products", "stock_quantity"],
    ["purchases", "quantity"],
    ["inventory_movements", "quantity_change"],
    ["inventory_counts", "expected_quantity"],
    ["inventory_counts", "counted_quantity"],
    ["inventory_counts", "difference"]
  ];

  for (const [tableName, columnName] of columns) {
    const existsResult = await client.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
       ) AS exists`,
      [tableName, columnName]
    );

    if (!existsResult.rows[0]?.exists) {
      continue;
    }

    await client.query(
      `ALTER TABLE ${tableName}
       ALTER COLUMN ${columnName} TYPE NUMERIC(10,2)
       USING ${columnName}::NUMERIC(10,2)`
    );
  }
}

function cashOperationFor(product) {
  if (!["Sularaha", "REPART", "🪙 REPART 🪙"].includes(product.category_name)) {
    return null;
  }

  const normalizedName = String(product.name || "").toLowerCase();
  if (normalizedName === "sissemakse") {
    return "deposit";
  }
  if (normalizedName === "väljamakse" || normalizedName === "valjamakse") {
    return "withdrawal";
  }
  return null;
}

async function ensureCashAccount(client) {
  const result = await client.query(
    `SELECT id
     FROM people
     WHERE lower(first_name) = lower($1)
       AND lower(last_name) = lower($2)
     ORDER BY id ASC
     LIMIT 1`,
    [CASH_ACCOUNT_FIRST_NAME, CASH_ACCOUNT_LAST_NAME]
  );

  if (result.rowCount > 0) {
    return result.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO people (first_name, last_name, coetus, konvent, is_visible, sort_order)
     VALUES ($1, $2, $3, $4, TRUE, 3000)
     RETURNING id`,
    [CASH_ACCOUNT_FIRST_NAME, CASH_ACCOUNT_LAST_NAME, "3000/I", "pseudo"]
  );

  return inserted.rows[0].id;
}

async function insertPurchase(client, { personId, productId, quantity, unitPrice, comment }) {
  const totalPrice = Number(unitPrice) * Number(quantity);
  const result = await client.query(
    `INSERT INTO purchases (person_id, product_id, quantity, unit_price, total_price, comment)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [personId, productId, quantity, unitPrice, totalPrice, comment || null]
  );

  return result.rows[0];
}

export async function createPurchase({ personId, productId, quantity, maxPurchaseQuantity = 100, comment }) {
  return transaction(async (client) => {
    const personResult = await client.query(
      "SELECT id, first_name, last_name FROM people WHERE id = $1",
      [personId]
    );

    if (personResult.rowCount === 0) {
      const err = new Error("Person not found");
      err.status = 404;
      throw err;
    }

    const productResult = await client.query(
      `SELECT
         p.id,
         p.name,
         p.price,
         p.stock_quantity,
         p.is_inventory_tracked,
         c.name AS category_name
       FROM products
       p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1
       FOR UPDATE OF p`,
      [productId]
    );

    if (productResult.rowCount === 0) {
      const err = new Error("Product not found");
      err.status = 404;
      throw err;
    }

    const product = productResult.rows[0];
    const unitPrice = Number(product.price);
    const cashOperation = cashOperationFor(product);

    if (!cashOperation && (!Number.isFinite(Number(quantity)) || Math.abs(Number(quantity)) > maxPurchaseQuantity)) {
      const err = new Error(`quantity must be between -${maxPurchaseQuantity} and ${maxPurchaseQuantity}`);
      err.status = 400;
      throw err;
    }

    if (cashOperation) {
      const amount = Math.abs(Number(quantity));
      if (!Number.isFinite(amount) || amount <= 0) {
        const err = new Error("cash amount must be positive");
        err.status = 400;
        throw err;
      }

      const cashAccountId = await ensureCashAccount(client);
      if (Number(personId) === Number(cashAccountId)) {
        const err = new Error("cash operation person cannot be the Sula Raha account");
        err.status = 400;
        throw err;
      }

      const selectedPerson = personResult.rows[0];
      const selectedPersonName = `${selectedPerson.first_name} ${selectedPerson.last_name}`;
      const baseComment = comment || product.name;
      const cashUnitPrice = Math.abs(unitPrice) || 1;
      const selectedQuantity = cashOperation === "deposit" ? -amount : amount;
      const cashQuantity = selectedQuantity;

      const selectedPurchase = await insertPurchase(client, {
        personId,
        productId,
        quantity: selectedQuantity,
        unitPrice: cashUnitPrice,
        comment: baseComment
      });

      await insertPurchase(client, {
        personId: cashAccountId,
        productId,
        quantity: cashQuantity,
        unitPrice: cashUnitPrice,
        comment: `${baseComment} (${selectedPersonName})`
      });

      return selectedPurchase;
    }

    const purchase = await insertPurchase(client, {
      personId,
      productId,
      quantity,
      unitPrice,
      comment
    });

    if (product.is_inventory_tracked) {
      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1
         WHERE id = $2`,
        [quantity, productId]
      );

      await client.query(
        `INSERT INTO inventory_movements (product_id, quantity_change, reason, comment)
         VALUES ($1, $2, $3, $4)`,
        [productId, -quantity, "purchase", "automatic from purchase"]
      );
    }

    return purchase;
  });
}

export async function cancelPurchase({ purchaseId, cancellationReason }) {
  return transaction(async (client) => {
    const purchaseResult = await client.query(
      `SELECT p.*, pr.is_inventory_tracked
       FROM purchases p
       JOIN products pr ON pr.id = p.product_id
       WHERE p.id = $1
       FOR UPDATE`,
      [purchaseId]
    );

    if (purchaseResult.rowCount === 0) {
      const err = new Error("Purchase not found");
      err.status = 404;
      throw err;
    }

    const purchase = purchaseResult.rows[0];

    if (purchase.is_cancelled) {
      const err = new Error("Purchase is already cancelled");
      err.status = 400;
      throw err;
    }

    const cancelledResult = await client.query(
      `UPDATE purchases
       SET is_cancelled = TRUE,
           cancelled_at = NOW(),
           cancellation_reason = $2
       WHERE id = $1
       RETURNING *`,
      [purchaseId, cancellationReason || null]
    );

    if (purchase.is_inventory_tracked) {
      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity + $1
         WHERE id = $2`,
        [purchase.quantity, purchase.product_id]
      );

      await client.query(
        `INSERT INTO inventory_movements (product_id, quantity_change, reason, comment)
         VALUES ($1, $2, $3, $4)`,
        [purchase.product_id, purchase.quantity, "purchase_cancelled", cancellationReason || "cancelled purchase"]
      );
    }

    return cancelledResult.rows[0];
  });
}
