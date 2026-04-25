import { transaction } from "../db.js";

export async function addInventoryMovement({ productId, quantityChange, reason, comment }) {
  return transaction(async (client) => {
    const productResult = await client.query(
      "SELECT id FROM products WHERE id = $1 FOR UPDATE",
      [productId]
    );

    if (productResult.rowCount === 0) {
      const err = new Error("Product not found");
      err.status = 404;
      throw err;
    }

    const movementResult = await client.query(
      `INSERT INTO inventory_movements (product_id, quantity_change, reason, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [productId, quantityChange, reason, comment || null]
    );

    await client.query(
      `UPDATE products
       SET stock_quantity = stock_quantity + $1
       WHERE id = $2`,
      [quantityChange, productId]
    );

    return movementResult.rows[0];
  });
}

export async function createInventoryReport({ comment, counts }) {
  return transaction(async (client) => {
    const reportResult = await client.query(
      `INSERT INTO inventory_count_reports (comment)
       VALUES ($1)
       RETURNING id, created_at`,
      [comment || null]
    );

    const report = reportResult.rows[0];

    for (const count of counts) {
      const productId = Number(count.product_id);
      const countedQuantity = Number(count.counted_quantity);

      if (!Number.isInteger(productId) || !Number.isInteger(countedQuantity)) {
        const err = new Error("Each count requires integer product_id and counted_quantity");
        err.status = 400;
        throw err;
      }

      const productResult = await client.query(
        `SELECT id, stock_quantity
         FROM products
         WHERE id = $1
         FOR UPDATE`,
        [productId]
      );

      if (productResult.rowCount === 0) {
        const err = new Error(`Product not found: ${productId}`);
        err.status = 404;
        throw err;
      }

      const expectedQuantity = productResult.rows[0].stock_quantity;
      const difference = countedQuantity - expectedQuantity;

      await client.query(
        `INSERT INTO inventory_counts
           (report_id, product_id, expected_quantity, counted_quantity, difference, comment)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [report.id, productId, expectedQuantity, countedQuantity, difference, count.comment || null]
      );

      await client.query(
        "UPDATE products SET stock_quantity = $1 WHERE id = $2",
        [countedQuantity, productId]
      );
    }

    return {
      report_id: report.id,
      created_at: report.created_at,
      counts_saved: counts.length
    };
  });
}
