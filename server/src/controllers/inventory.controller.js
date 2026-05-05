import { hasTableColumn, query } from "../db.js";
import { addInventoryMovement, createInventoryReport } from "../services/inventory.service.js";

export async function getInventory(req, res, next) {
  try {
    const hasProductUnit = await hasTableColumn("products", "unit");
    const unitSql = hasProductUnit ? "p.unit" : "'tk'::TEXT AS unit";

    const result = await query(
      `SELECT
         p.id,
         p.name,
         p.stock_quantity,
         ${unitSql},
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
    const hasProductUnit = await hasTableColumn("products", "unit");
    const unitSql = hasProductUnit ? "p.unit" : "'tk'::TEXT AS unit";

    const result = await query(
      `SELECT
         p.id,
         p.name,
         p.stock_quantity AS expected_quantity,
         ${unitSql},
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
    const { comment, valvevarv, counts, cash_counted } = req.body;
    if (!Array.isArray(counts) || counts.length === 0) {
      return res.status(400).json({ error: "counts array is required" });
    }

    if (!String(valvevarv || "").trim()) {
      return res.status(400).json({ error: "valvevarv is required" });
    }

    const result = await createInventoryReport({ comment, valvevarv, counts, cash_counted });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCashBalance(req, res, next) {
  try {
    // Get the Sularaha account balance from the people table
    // Sularaha account typically has a specific id or name
    // For now, we'll sum up all cash transactions
    const result = await query(
      `SELECT 
         COALESCE(SUM(CASE 
           WHEN p.id = 1 AND pur.product_id IN (28, 27) 
           THEN pur.total_price * (CASE WHEN pur.product_id = 28 THEN 1 ELSE -1 END)
           ELSE 0 
         END), 0) AS balance
       FROM purchases pur
       RIGHT JOIN people p ON p.id = 1
       WHERE pur.is_cancelled = FALSE`
    );

    const balance = Number(result.rows[0]?.balance || 0);
    res.json({ balance: balance.toFixed(2) });
  } catch (error) {
    next(error);
  }
}

function reportStatus(totalExpected, totalCounted) {
  const expected = Number(totalExpected || 0);
  const counted = Number(totalCounted || 0);

  if (counted >= expected) {
    return { status: "Korras", status_color: "green", loss_percent: 0 };
  }

  if (expected <= 0) {
    return { status: "Korras", status_color: "green", loss_percent: 0 };
  }

  const lossPercent = (Math.abs(counted - expected) / expected) * 100;
  if (lossPercent <= 5) {
    return { status: "Väike puudujääk", status_color: "yellow", loss_percent: Number(lossPercent.toFixed(2)) };
  }

  return { status: "Suur puudujääk", status_color: "red", loss_percent: Number(lossPercent.toFixed(2)) };
}

export async function getInventoryReports(req, res, next) {
  try {
    const hasValvevarv = await hasTableColumn("inventory_count_reports", "valvevarv");
    const hasCashCounted = await hasTableColumn("inventory_count_reports", "cash_counted");
    const valvevarvSql = hasValvevarv ? "r.valvevarv" : "'Määramata'::TEXT AS valvevarv";
    const valvevarvGroupBy = hasValvevarv ? ", r.valvevarv" : "";
    const cashCountedSql = hasCashCounted ? "r.cash_counted" : "0::NUMERIC(10,2) AS cash_counted";
    const cashCountedGroupBy = hasCashCounted ? ", r.cash_counted" : "";

    const defaultLimit = req.baseUrl.startsWith("/api/admin") ? 14 : 50;
    const requestedLimit = Number.parseInt(String(req.query.limit || defaultLimit), 10);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : defaultLimit;

    const params = [limit];
    const where = [];

    const dateFrom = (req.query.date_from || "").trim();
    const dateTo = (req.query.date_to || "").trim();

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
         ${valvevarvSql},
         ${cashCountedSql},
         r.comment,
         COUNT(c.id)::INT AS counted_products,
         COALESCE(SUM(ABS(c.difference)), 0)::NUMERIC(10,2) AS total_absolute_difference,
         COALESCE(SUM(c.expected_quantity), 0)::NUMERIC(10,2) AS total_expected,
         COALESCE(SUM(c.counted_quantity), 0)::NUMERIC(10,2) AS total_counted
       FROM inventory_count_reports r
       LEFT JOIN inventory_counts c ON c.report_id = r.id
       ${whereSql}
       GROUP BY r.id, r.created_at${valvevarvGroupBy}${cashCountedGroupBy}, r.comment
       ORDER BY r.created_at DESC
       LIMIT $1`,
      params
    );

    const mapped = result.rows.map((row) => ({
      ...row,
      ...reportStatus(row.total_expected, row.total_counted)
    }));

    res.json(mapped);
  } catch (error) {
    next(error);
  }
}

export async function getInventoryReportById(req, res, next) {
  try {
    const reportId = Number(req.params.id);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ error: "valid report id is required" });
    }

    const hasValvevarv = await hasTableColumn("inventory_count_reports", "valvevarv");
    const hasCashCounted = await hasTableColumn("inventory_count_reports", "cash_counted");
    const reportSelect = hasValvevarv
      ? `id, created_at, valvevarv, comment, ${hasCashCounted ? "cash_counted" : "0::NUMERIC(10,2) AS cash_counted"}`
      : `id, created_at, 'Määramata'::TEXT AS valvevarv, comment, ${hasCashCounted ? "cash_counted" : "0::NUMERIC(10,2) AS cash_counted"}`;

    const reportResult = await query(
      `SELECT ${reportSelect}
       FROM inventory_count_reports
       WHERE id = $1`,
      [reportId]
    );

    if (reportResult.rowCount === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const hasProductUnit = await hasTableColumn("products", "unit");
    const unitSql = hasProductUnit ? "p.unit" : "'tk'::TEXT AS unit";

    const rowsResult = await query(
      `SELECT
         c.id,
         c.product_id,
         p.name AS product_name,
         cat.name AS category_name,
         c.expected_quantity,
         c.counted_quantity,
         c.difference,
         c.comment,
         ${unitSql}
       FROM inventory_counts c
       JOIN products p ON p.id = c.product_id
       LEFT JOIN categories cat ON cat.id = p.category_id
       WHERE c.report_id = $1
       ORDER BY cat.sort_order ASC NULLS LAST, p.sort_order ASC, p.name ASC`,
      [reportId]
    );

    const rows = rowsResult.rows;
    const totalExpected = rows.reduce((sum, row) => sum + Number(row.expected_quantity || 0), 0);
    const totalCounted = rows.reduce((sum, row) => sum + Number(row.counted_quantity || 0), 0);

    res.json({
      report: {
        ...reportResult.rows[0],
        total_expected: totalExpected,
        total_counted: totalCounted,
        ...reportStatus(totalExpected, totalCounted)
      },
      rows
    });
  } catch (error) {
    next(error);
  }
}
