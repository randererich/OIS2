import { hasTableColumn, query } from "../db.js";
import { createPurchase } from "../services/purchase.service.js";

const MAX_PURCHASE_QUANTITY = 100;

export async function getPurchases(req, res, next) {
  try {
    const hasProductUnit = await hasTableColumn("products", "unit");
    const unitSql = hasProductUnit ? "pr.unit AS product_unit" : "'tk'::TEXT AS product_unit";

    const q = (req.query.search || req.query.q || "").trim();
    const includeCancelled = String(req.query.include_cancelled || "false") === "true";
    const dateFrom = (req.query.date_from || "").trim();
    const dateTo = (req.query.date_to || "").trim();

    const requestedLimit = Number.parseInt(String(req.query.limit || "100"), 10);
    const requestedOffset = Number.parseInt(String(req.query.offset || "0"), 10);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 500) : 100;
    const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;

    const params = [];
    const where = [];

    if (!includeCancelled) {
      where.push("pu.is_cancelled = FALSE");
    }

    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(CONCAT(pe.first_name, ' ', pe.last_name) ILIKE $${params.length}
          OR pr.name ILIKE $${params.length}
          OR COALESCE(pu.comment, '') ILIKE $${params.length})`
      );
    }

    if (dateFrom) {
      params.push(dateFrom);
      where.push(`pu.created_at >= $${params.length}::timestamptz`);
    }

    if (dateTo) {
      params.push(dateTo);
      where.push(`pu.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    params.push(limit);
    params.push(offset);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const result = await query(
      `SELECT
         pu.*,
         pe.first_name,
         pe.last_name,
         pr.name AS product_name,
         ${unitSql}
       FROM purchases pu
       JOIN people pe ON pe.id = pu.person_id
       JOIN products pr ON pr.id = pu.product_id
       ${whereSql}
       ORDER BY pu.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function postPurchase(req, res, next) {
  try {
    const { person_id, product_id, quantity, comment } = req.body;
    const parsedQuantity = Number(quantity);

    if (!person_id || !product_id || !Number.isInteger(parsedQuantity) || parsedQuantity === 0) {
      return res.status(400).json({ error: "person_id, product_id and non-zero integer quantity are required" });
    }

    if (Math.abs(parsedQuantity) > MAX_PURCHASE_QUANTITY) {
      return res.status(400).json({ error: `quantity must be between -${MAX_PURCHASE_QUANTITY} and ${MAX_PURCHASE_QUANTITY}` });
    }

    const purchase = await createPurchase({
      personId: Number(person_id),
      productId: Number(product_id),
      quantity: parsedQuantity,
      comment
    });

    res.status(201).json(purchase);
  } catch (error) {
    next(error);
  }
}
