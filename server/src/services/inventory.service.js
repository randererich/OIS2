import { hasTableColumn, transaction } from "../db.js";

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

export async function createInventoryReport({ comment, valvevarv, counts, cash_counted }) {
  return transaction(async (client) => {
    await client.query(
      "ALTER TABLE inventory_count_reports ADD COLUMN IF NOT EXISTS cash_counted NUMERIC(10,2) NOT NULL DEFAULT 0"
    );

    const hasValvevarv = await hasTableColumn("inventory_count_reports", "valvevarv");
    const hasCashCounted = true;

    let reportResult;
    let reportColumns = ["valvevarv", "comment"];
    let reportValues = [String(valvevarv || "").trim() || "Määramata", comment || null];
    let reportParams = ["$1", "$2"];

    if (hasCashCounted) {
      reportColumns.push("cash_counted");
      reportValues.push(Number(cash_counted || 0));
      reportParams.push("$3");
    }

    const insertSql = `INSERT INTO inventory_count_reports (${reportColumns.join(", ")})
         VALUES (${reportParams.join(", ")})
         RETURNING id, created_at${hasValvevarv ? ", valvevarv" : ""}${hasCashCounted ? ", cash_counted" : ""}`;

    reportResult = await client.query(insertSql, reportValues);

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
      counts_saved: counts.length,
      cash_counted: Number(cash_counted || 0)
    };
  });
}
