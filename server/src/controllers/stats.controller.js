import { hasTableColumn, query } from "../db.js";

function getLimit(rawLimit) {
  const parsed = Number.parseInt(rawLimit || "20", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
}

function parseMonth(monthInput) {
  if (!/^\d{4}-\d{2}$/.test(monthInput || "")) {
    return null;
  }
  const [year, month] = monthInput.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    return null;
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
}

function buildDateFilter(req, startIndex = 1, tableAlias = "pu") {
  const params = [];
  const clauses = [];
  const dateFrom = (req.query.date_from || "").trim();
  const dateTo = (req.query.date_to || "").trim();

  if (dateFrom) {
    params.push(dateFrom);
    clauses.push(`${tableAlias}.created_at >= $${startIndex + params.length - 1}::timestamptz`);
  }

  if (dateTo) {
    params.push(dateTo);
    clauses.push(`${tableAlias}.created_at < ($${startIndex + params.length - 1}::date + INTERVAL '1 day')`);
  }

  return {
    params,
    sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : ""
  };
}

export async function getCategoryTotals(req, res, next) {
  try {
    const limit = getLimit(req.query.limit);
    const dateFilter = buildDateFilter(req, 1);
    const params = [...dateFilter.params, limit];

    const result = await query(
      `SELECT
         c.id AS category_id,
         COALESCE(c.name, 'Määramata') AS category,
         CASE
           WHEN COUNT(DISTINCT pr.unit) = 1 THEN MIN(pr.unit)
           ELSE NULL
         END AS unit,
         COUNT(pu.id)::INT AS purchase_count,
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS total_quantity,
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_revenue
       FROM purchases pu
       JOIN products pr ON pr.id = pu.product_id
       LEFT JOIN categories c ON c.id = pr.category_id
       WHERE pu.is_cancelled = FALSE
         ${dateFilter.sql}
       GROUP BY c.id, c.name
       ORDER BY total_revenue DESC, total_quantity DESC, category ASC
       LIMIT $${params.length}`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getTugevaimCoetus(req, res, next) {
  try {
    const limit = getLimit(req.query.limit);
    const dateFilter = buildDateFilter(req, 1);
    const params = [...dateFilter.params, limit];

    const result = await query(
      `SELECT
         COALESCE(NULLIF(TRIM(pe.coetus), ''), 'Määramata') AS coetus,
         COUNT(pu.id)::INT AS purchase_count,
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS total_quantity,
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_spent
       FROM purchases pu
       JOIN people pe ON pe.id = pu.person_id
       WHERE pu.is_cancelled = FALSE
         ${dateFilter.sql}
       GROUP BY COALESCE(NULLIF(TRIM(pe.coetus), ''), 'Määramata')
       ORDER BY total_spent DESC, total_quantity DESC, coetus ASC
       LIMIT $${params.length}`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getTopSpenders(req, res, next) {
  try {
    const limit = getLimit(req.query.limit);
    const dateFilter = buildDateFilter(req, 1);
    const params = [...dateFilter.params, limit];

    const result = await query(
      `SELECT
         pe.id,
         pe.first_name,
         pe.last_name,
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_spent,
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS total_items
       FROM people pe
       JOIN purchases pu ON pu.person_id = pe.id
       WHERE pu.is_cancelled = FALSE
         ${dateFilter.sql}
       GROUP BY pe.id, pe.first_name, pe.last_name
       ORDER BY total_spent DESC, total_items DESC, pe.last_name ASC
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getTopItemCounts(req, res, next) {
  try {
    const limit = getLimit(req.query.limit);
    const dateFilter = buildDateFilter(req, 1);
    const params = [...dateFilter.params, limit];

    const result = await query(
      `SELECT
         pe.id,
         pe.first_name,
         pe.last_name,
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS total_items,
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_spent
       FROM people pe
       JOIN purchases pu ON pu.person_id = pe.id
       WHERE pu.is_cancelled = FALSE
         ${dateFilter.sql}
       GROUP BY pe.id, pe.first_name, pe.last_name
       ORDER BY total_items DESC, total_spent DESC, pe.last_name ASC
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getTopProductsByQuantity(req, res, next) {
  try {
    const hasProductUnit = await hasTableColumn("products", "unit");
    const unitSql = hasProductUnit ? "pr.unit" : "'tk'::TEXT AS unit";
    const unitGroupBy = hasProductUnit ? ", pr.unit" : "";

    const limit = getLimit(req.query.limit);
    const dateFilter = buildDateFilter(req, 1);
    const params = [...dateFilter.params, limit];

    const result = await query(
      `SELECT
         pr.id,
         pr.name,
        ${unitSql},
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS total_quantity,
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_revenue
       FROM products pr
       JOIN purchases pu ON pu.product_id = pr.id
       WHERE pu.is_cancelled = FALSE
         ${dateFilter.sql}
      GROUP BY pr.id, pr.name${unitGroupBy}
       ORDER BY total_quantity DESC, total_revenue DESC, pr.name ASC
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getTopProductsByRevenue(req, res, next) {
  try {
    const hasProductUnit = await hasTableColumn("products", "unit");
    const unitSql = hasProductUnit ? "pr.unit" : "'tk'::TEXT AS unit";
    const unitGroupBy = hasProductUnit ? ", pr.unit" : "";

    const limit = getLimit(req.query.limit);
    const dateFilter = buildDateFilter(req, 1);
    const params = [...dateFilter.params, limit];

    const result = await query(
      `SELECT
         pr.id,
         pr.name,
        ${unitSql},
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_revenue,
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS total_quantity
       FROM products pr
       JOIN purchases pu ON pu.product_id = pr.id
       WHERE pu.is_cancelled = FALSE
         ${dateFilter.sql}
      GROUP BY pr.id, pr.name${unitGroupBy}
       ORDER BY total_revenue DESC, total_quantity DESC, pr.name ASC
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getProductBuyers(req, res, next) {
  try {
    const hasProductUnit = await hasTableColumn("products", "unit");
    const unitSql = hasProductUnit ? "pr.unit" : "'tk'::TEXT AS unit";
    const unitGroupBy = hasProductUnit ? ", pr.unit" : "";

    const productId = Number(req.params.id);
    const limit = getLimit(req.query.limit);
    if (!productId) {
      return res.status(400).json({ error: "valid product id is required" });
    }

    const dateFilter = buildDateFilter(req, 2);
    const params = [productId, ...dateFilter.params, limit];

    const result = await query(
      `SELECT
         pe.id,
         pe.first_name,
         pe.last_name,
        ${unitSql},
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS amount,
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_spent
       FROM purchases pu
       JOIN products pr ON pr.id = pu.product_id
       JOIN people pe ON pe.id = pu.person_id
       WHERE pu.product_id = $1
         AND pu.is_cancelled = FALSE
         ${dateFilter.sql}
      GROUP BY pe.id, pe.first_name, pe.last_name${unitGroupBy}
       ORDER BY amount DESC, total_spent DESC, pe.last_name ASC
       LIMIT $${params.length}`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getCategoryBuyers(req, res, next) {
  try {
    const categoryId = Number(req.params.id);
    const limit = getLimit(req.query.limit);
    if (!categoryId) {
      return res.status(400).json({ error: "valid category id is required" });
    }

    const dateFilter = buildDateFilter(req, 2);
    const params = [categoryId, ...dateFilter.params, limit];

    const result = await query(
      `SELECT
         pe.id,
         pe.first_name,
         pe.last_name,
         CASE
           WHEN COUNT(DISTINCT pr.unit) = 1 THEN MIN(pr.unit)
           ELSE NULL
         END AS unit,
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS amount,
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_spent
       FROM purchases pu
       JOIN products pr ON pr.id = pu.product_id
       JOIN people pe ON pe.id = pu.person_id
       WHERE pr.category_id = $1
         AND pu.is_cancelled = FALSE
         ${dateFilter.sql}
       GROUP BY pe.id, pe.first_name, pe.last_name
       ORDER BY amount DESC, total_spent DESC, pe.last_name ASC
       LIMIT $${params.length}`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getMonthTopSpenders(req, res, next) {
  try {
    const limit = getLimit(req.query.limit);
    const parsedMonth = parseMonth(req.query.month);

    if (!parsedMonth) {
      return res.status(400).json({ error: "month must be YYYY-MM" });
    }

    const result = await query(
      `SELECT
         pe.id,
         pe.first_name,
         pe.last_name,
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_spent,
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS total_items
       FROM purchases pu
       JOIN people pe ON pe.id = pu.person_id
       WHERE pu.is_cancelled = FALSE
         AND pu.created_at >= $1
         AND pu.created_at < $2
       GROUP BY pe.id, pe.first_name, pe.last_name
       ORDER BY total_spent DESC, total_items DESC, pe.last_name ASC
       LIMIT $3`,
      [parsedMonth.start.toISOString(), parsedMonth.end.toISOString(), limit]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getMonthTopProducts(req, res, next) {
  try {
    const hasProductUnit = await hasTableColumn("products", "unit");
    const unitSql = hasProductUnit ? "pr.unit" : "'tk'::TEXT AS unit";
    const unitGroupBy = hasProductUnit ? ", pr.unit" : "";

    const limit = getLimit(req.query.limit);
    const parsedMonth = parseMonth(req.query.month);

    if (!parsedMonth) {
      return res.status(400).json({ error: "month must be YYYY-MM" });
    }

    const result = await query(
      `SELECT
         pr.id,
         pr.name,
        ${unitSql},
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS total_quantity,
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_revenue
       FROM purchases pu
       JOIN products pr ON pr.id = pu.product_id
       WHERE pu.is_cancelled = FALSE
         AND pu.created_at >= $1
         AND pu.created_at < $2
      GROUP BY pr.id, pr.name${unitGroupBy}
       ORDER BY total_quantity DESC, total_revenue DESC, pr.name ASC
       LIMIT $3`,
      [parsedMonth.start.toISOString(), parsedMonth.end.toISOString(), limit]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getHighestDebts(req, res, next) {
  try {
    const limit = getLimit(req.query.limit);
    const result = await query(
      `SELECT id, first_name, last_name, coetus, konvent, debt
       FROM person_debts
       WHERE debt > 0
       ORDER BY debt DESC, last_name ASC, first_name ASC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getHighestCredits(req, res, next) {
  try {
    const limit = getLimit(req.query.limit);
    const result = await query(
      `SELECT
         id,
         first_name,
         last_name,
         coetus,
         konvent,
         debt,
         ABS(debt)::NUMERIC(10,2) AS credit_amount
       FROM person_debts
       WHERE debt < 0
       ORDER BY debt ASC, last_name ASC, first_name ASC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}
