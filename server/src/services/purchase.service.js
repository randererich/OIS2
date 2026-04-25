import { transaction } from "../db.js";

export async function createPurchase({ personId, productId, quantity, comment }) {
  return transaction(async (client) => {
    const personResult = await client.query(
      "SELECT id FROM people WHERE id = $1",
      [personId]
    );

    if (personResult.rowCount === 0) {
      const err = new Error("Person not found");
      err.status = 404;
      throw err;
    }

    const productResult = await client.query(
      `SELECT id, name, price, stock_quantity, is_inventory_tracked
       FROM products
       WHERE id = $1
       FOR UPDATE`,
      [productId]
    );

    if (productResult.rowCount === 0) {
      const err = new Error("Product not found");
      err.status = 404;
      throw err;
    }

    const product = productResult.rows[0];
    const unitPrice = Number(product.price);
    const totalPrice = unitPrice * Number(quantity);

    const purchaseResult = await client.query(
      `INSERT INTO purchases (person_id, product_id, quantity, unit_price, total_price, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [personId, productId, quantity, unitPrice, totalPrice, comment || null]
    );

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

    return purchaseResult.rows[0];
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
