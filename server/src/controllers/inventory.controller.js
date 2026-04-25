import { query } from "../db.js";
import { addInventoryMovement, createInventoryReport } from "../services/inventory.service.js";

export async function getInventory(req, res, next) {
  try {
    const result = await query(
      `SELECT
         p.id,
         p.name,
         p.stock_quantity,
         p.price,
         p.is_inventory_tracked,
         c.name AS category_name,
         c.emoji AS category_emoji
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY c.sort_order ASC NULLS LAST, p.sort_order ASC, p.name ASC`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getInventoryCountProducts(req, res, next) {
  try {
    const result = await query(
      `SELECT
         p.id,
         p.name,
         p.stock_quantity AS expected_quantity,
         c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_inventory_tracked = TRUE
       ORDER BY c.sort_order ASC NULLS LAST, p.sort_order ASC, p.name ASC`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function postInventoryMovement(req, res, next) {
  try {
    const { product_id, quantity_change, reason, comment } = req.body;
    const normalizedReason = (reason || "stock_add").toString().trim() || "stock_add";

    if (!product_id || !Number.isInteger(Number(quantity_change)) || Number(quantity_change) === 0) {
      return res.status(400).json({ error: "product_id and non-zero integer quantity_change are required" });
    }

    const movement = await addInventoryMovement({
      productId: Number(product_id),
      quantityChange: Number(quantity_change),
      reason: normalizedReason,
      comment
    });

    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
}

export async function createInventoryReportController(req, res, next) {
  try {
    const { comment, counts } = req.body;
    if (!Array.isArray(counts) || counts.length === 0) {
      return res.status(400).json({ error: "counts array is required" });
    }

    const result = await createInventoryReport({ comment, counts });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getInventoryReports(req, res, next) {
  try {
    const dateFrom = (req.query.date_from || "").trim();
    const dateTo = (req.query.date_to || "").trim();
    const params = [];
    const where = [];

    if (dateFrom) {
      params.push(dateFrom);
      where.push(`r.created_at >= $${params.length}::timestamptz`);
    }

    if (dateTo) {
      params.push(dateTo);
      where.push(`r.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const result = await query(
      `SELECT
         r.id,
         r.created_at,
         r.comment,
         COUNT(c.id)::INT AS counted_products,
         COALESCE(SUM(ABS(c.difference)), 0)::INT AS total_absolute_difference
       FROM inventory_count_reports r
       LEFT JOIN inventory_counts c ON c.report_id = r.id
       ${whereSql}
       GROUP BY r.id, r.created_at, r.comment
       ORDER BY r.created_at DESC
       LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getInventoryReportById(req, res, next) {
  try {
    const reportId = Number(req.params.id);
    if (!reportId) {
      return res.status(400).json({ error: "valid report id is required" });
    }

    const reportResult = await query(
      `SELECT id, created_at, comment
       FROM inventory_count_reports
       WHERE id = $1`,
      [reportId]
    );

    if (reportResult.rowCount === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const rowsResult = await query(
      `SELECT
         c.id,
         c.product_id,
         p.name AS product_name,
         cat.name AS category_name,
         c.expected_quantity,
         c.counted_quantity,
         c.difference,
         c.comment
       FROM inventory_counts c
       JOIN products p ON p.id = c.product_id
       LEFT JOIN categories cat ON cat.id = p.category_id
       WHERE c.report_id = $1
       ORDER BY cat.sort_order ASC NULLS LAST, p.sort_order ASC, p.name ASC`,
      [reportId]
    );

    res.json({
      report: reportResult.rows[0],
      rows: rowsResult.rows
    });
  } catch (error) {
    next(error);
  }
}
