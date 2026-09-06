import { hasTableColumn, query } from "../db.js";
import { purchaseDebtEffect } from "../services/debtRules.js";

function coetusSortSql(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `
  CASE WHEN ${prefix}coetus ~ '^\\d{4}/(I|II)$' THEN 1 ELSE 0 END DESC,
  CASE WHEN ${prefix}coetus ~ '^\\d{4}/(I|II)$' THEN split_part(${prefix}coetus, '/', 1)::INT ELSE 0 END DESC,
  CASE split_part(${prefix}coetus, '/', 2)
    WHEN 'II' THEN 2
    WHEN 'I' THEN 1
    ELSE 0
  END DESC
`;
}

async function buildDebtSelectionFilter(req) {
  const hasProductId = req.query.product_id !== undefined;
  const hasQuantity = req.query.quantity !== undefined;

  if (!hasProductId && !hasQuantity) {
    return { pendingDebtEffect: null };
  }

  if (!hasProductId || !hasQuantity) {
    return { error: "product_id and quantity are required together", status: 400 };
  }

  const productId = Number(req.query.product_id);
  const quantity = Number(req.query.quantity);

  if (!Number.isInteger(productId) || productId <= 0 || !Number.isFinite(quantity) || quantity === 0) {
    return { error: "valid product_id and non-zero quantity are required", status: 400 };
  }

  const productResult = await query(
    `SELECT p.id, p.name, p.price, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [productId]
  );

  if (productResult.rowCount === 0) {
    return { error: "Product not found", status: 404 };
  }

  return {
    pendingDebtEffect: purchaseDebtEffect({
      product: productResult.rows[0],
      quantity,
      paidWithCash: false
    })
  };
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

function getLimit(rawLimit, defaultLimit = 50) {
  const parsed = Number.parseInt(rawLimit || String(defaultLimit), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultLimit;
  }
  return Math.min(parsed, 200);
}

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function buildPersonPurchaseDateFilter(req, startIndex = 2) {
  const month = String(req.query.month || "").trim();
  const dateFrom = String(req.query.date_from || "").trim();
  const dateTo = String(req.query.date_to || "").trim();

  if (month && !dateFrom && !dateTo) {
    const parsedMonth = parseMonth(month);
    if (!parsedMonth) {
      return { error: "month must be YYYY-MM" };
    }

    return {
      params: [parsedMonth.start.toISOString(), parsedMonth.end.toISOString()],
      purchaseSql: `AND pu.created_at >= $${startIndex} AND pu.created_at < $${startIndex + 1}`,
      adjustmentSql: `AND da.created_at >= $${startIndex} AND da.created_at < $${startIndex + 1}`,
      range: { month }
    };
  }

  if (dateFrom && !isValidDateInput(dateFrom)) {
    return { error: "date_from must be YYYY-MM-DD" };
  }

  if (dateTo && !isValidDateInput(dateTo)) {
    return { error: "date_to must be YYYY-MM-DD" };
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { error: "date_from must be before or equal to date_to" };
  }

  const params = [];
  const purchaseClauses = [];
  const adjustmentClauses = [];

  if (dateFrom) {
    params.push(dateFrom);
    const placeholder = `$${startIndex + params.length - 1}`;
    purchaseClauses.push(`pu.created_at >= ${placeholder}::date`);
    adjustmentClauses.push(`da.created_at >= ${placeholder}::date`);
  }

  if (dateTo) {
    params.push(dateTo);
    const placeholder = `$${startIndex + params.length - 1}`;
    purchaseClauses.push(`pu.created_at < (${placeholder}::date + INTERVAL '1 day')`);
    adjustmentClauses.push(`da.created_at < (${placeholder}::date + INTERVAL '1 day')`);
  }

  return {
    params,
    purchaseSql: purchaseClauses.length ? `AND ${purchaseClauses.join(" AND ")}` : "",
    adjustmentSql: adjustmentClauses.length ? `AND ${adjustmentClauses.join(" AND ")}` : "",
    range: { date_from: dateFrom || null, date_to: dateTo || null }
  };
}

export async function getPeople(req, res, next) {
  try {
    const q = (req.query.q || "").trim();
    const includeHidden = String(req.query.include_hidden || "false") === "true";
    const visibilityFilter = includeHidden ? "" : "is_visible = TRUE AND ";

    if (q) {
      const result = await query(
        `SELECT *
         FROM people
         WHERE ${visibilityFilter}(CONCAT(first_name, ' ', last_name) ILIKE $1
            OR COALESCE(coetus, '') ILIKE $1
            OR COALESCE(konvent, '') ILIKE $1)
         ORDER BY ${coetusSortSql()}, last_name ASC, first_name ASC`,
        [`%${q}%`]
      );
      return res.json(result.rows);
    }

    const result = await query(
      `SELECT *
       FROM people
       ${includeHidden ? "" : "WHERE is_visible = TRUE"}
       ORDER BY ${coetusSortSql()}, last_name ASC, first_name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getVisiblePeople(req, res, next) {
  try {
    const debtFilter = await buildDebtSelectionFilter(req);
    if (debtFilter.error) {
      return res.status(debtFilter.status).json({ error: debtFilter.error });
    }

    const q = (req.query.q || "").trim();
    const params = [];
    const where = ["pe.is_visible = TRUE"];
    const joins = [];

    if (q) {
      params.push(`%${q}%`);
      where.push("CONCAT(pe.first_name, ' ', pe.last_name) ILIKE $1");
    }

    if (debtFilter.pendingDebtEffect > 0) {
      joins.push("LEFT JOIN person_debts pd ON pd.id = pe.id");
      params.push(debtFilter.pendingDebtEffect);
      where.push(`NOT (pe.disallow_debt = TRUE AND COALESCE(pd.debt, 0) + $${params.length} > 0)`);
    }

    const result = await query(
      `SELECT pe.*
       FROM people pe
       ${joins.join(" ")}
       WHERE ${where.join(" AND ")}
       ORDER BY ${coetusSortSql("pe")}, pe.sort_order ASC, pe.last_name ASC, pe.first_name ASC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getRecentBuyers(req, res, next) {
  try {
    const debtFilter = await buildDebtSelectionFilter(req);
    if (debtFilter.error) {
      return res.status(debtFilter.status).json({ error: debtFilter.error });
    }

    const requestedMinutes = Number.parseInt(String(req.query.minutes || "20"), 10);
    const minutes = Number.isInteger(requestedMinutes) && requestedMinutes > 0
      ? Math.min(requestedMinutes, 720)
      : 20;
    const params = [minutes];
    const where = ["NOT (lower(pe.first_name) = lower('Sula') AND lower(pe.last_name) = lower('Raha'))"];

    if (debtFilter.pendingDebtEffect > 0) {
      params.push(debtFilter.pendingDebtEffect);
      where.push(`NOT (pe.disallow_debt = TRUE AND COALESCE(pd.debt, 0) + $${params.length} > 0)`);
    }

    const result = await query(
      `WITH recent AS (
         SELECT
           pu.person_id,
           MAX(pu.created_at) AS last_purchase_at
         FROM purchases pu
         WHERE pu.is_cancelled = FALSE
           AND pu.created_at >= NOW() - ($1::INT * INTERVAL '1 minute')
         GROUP BY pu.person_id
       )
       SELECT
         pe.id,
         pe.first_name,
         pe.last_name,
         pe.coetus,
         pe.konvent,
         r.last_purchase_at,
         pd.debt AS balance
       FROM recent r
       JOIN people pe ON pe.id = r.person_id
       LEFT JOIN person_debts pd ON pd.id = pe.id
       WHERE ${where.join(" AND ")}
       ORDER BY r.last_purchase_at DESC, pe.last_name ASC, pe.first_name ASC`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getPersonBalance(req, res, next) {
  try {
    const personId = Number(req.params.id);
    if (!personId) {
      return res.status(400).json({ error: "valid person id is required" });
    }

    const result = await query(
      `SELECT id AS person_id, first_name, last_name, debt AS balance
       FROM person_debts
       WHERE id = $1`,
      [personId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getPersonPurchases(req, res, next) {
  try {
    const personId = Number(req.params.id);
    const includeCancelled = String(req.query.include_cancelled || "false") === "true";
    const limit = getLimit(req.query.limit, 50);

    if (!personId) {
      return res.status(400).json({ error: "valid person id is required" });
    }

    const dateFilter = buildPersonPurchaseDateFilter(req);
    if (dateFilter.error) {
      return res.status(400).json({ error: dateFilter.error });
    }

    const personResult = await query(
      `SELECT id, first_name, last_name, coetus, konvent, debt AS balance
       FROM person_debts
       WHERE id = $1`,
      [personId]
    );

    if (personResult.rowCount === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    const params = [personId, ...dateFilter.params];
    let cancellationFilter = "AND pu.is_cancelled = FALSE";
    if (includeCancelled) {
      cancellationFilter = "";
    }

    const hasProductUnit = await hasTableColumn("products", "unit");
    const summaryUnitSql = hasProductUnit ? "pr.unit" : "'tk'::TEXT";
    const summaryUnitGroupBy = hasProductUnit ? ", pr.unit" : "";
    const unitSql = hasProductUnit ? "pr.unit" : "'tk'::TEXT AS unit";

    const summaryResult = await query(
      `SELECT
         pu.product_id,
         pr.name AS product_name,
         ${summaryUnitSql} AS unit,
         COUNT(pu.id)::INT AS purchase_count,
         COALESCE(SUM(pu.quantity), 0)::NUMERIC(10,2) AS total_quantity,
         COALESCE(SUM(pu.total_price), 0)::NUMERIC(10,2) AS total_sum
       FROM purchases pu
       JOIN products pr ON pr.id = pu.product_id
       WHERE pu.person_id = $1
         ${dateFilter.purchaseSql}
         ${cancellationFilter}
       GROUP BY pu.product_id, pr.name${summaryUnitGroupBy}
       ORDER BY total_quantity DESC, total_sum DESC, pr.name ASC`,
      params
    );

    const purchaseParams = [...params, limit];
    const limitPlaceholder = `$${purchaseParams.length}`;

    const purchasesResult = await query(
      `SELECT *
       FROM (
         SELECT
           pu.id::TEXT AS id,
           pu.created_at,
           pr.name AS product_name,
           ${unitSql},
           pu.quantity,
           pu.total_price,
           pu.comment,
           pu.is_cancelled,
           pu.paid_with_cash,
           pu.cash_operation,
           NULL::TEXT AS debt_adjustment_operation
         FROM purchases pu
         JOIN products pr ON pr.id = pu.product_id
         WHERE pu.person_id = $1
           ${dateFilter.purchaseSql}
           ${cancellationFilter}

         UNION ALL

         SELECT
           CONCAT('debt-adjustment-', da.id) AS id,
           da.created_at,
           'Võla korrigeerimine' AS product_name,
           ''::TEXT AS unit,
           NULL::NUMERIC(10,2) AS quantity,
           da.amount AS total_price,
           da.comment,
           FALSE AS is_cancelled,
           FALSE AS paid_with_cash,
           NULL::TEXT AS cash_operation,
           da.operation AS debt_adjustment_operation
         FROM debt_adjustments da
         WHERE da.person_id = $1
           ${dateFilter.adjustmentSql}
       ) rows
       ORDER BY created_at DESC
       LIMIT ${limitPlaceholder}`,
      purchaseParams
    );

    res.json({
      person: personResult.rows[0],
      range: dateFilter.range,
      limit,
      summary_by_product: summaryResult.rows,
      purchases: purchasesResult.rows
    });
  } catch (error) {
    next(error);
  }
}

export const getPersonMonthlyPurchases = getPersonPurchases;

export async function createPerson(req, res, next) {
  try {
    const {
      first_name,
      last_name,
      coetus,
      konvent,
      is_visible = true,
      disallow_debt = false,
      sort_order
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: "first_name and last_name are required" });
    }

    let resolvedSortOrder = Number(sort_order);
    if (!Number.isInteger(resolvedSortOrder) || resolvedSortOrder <= 0) {
      const sortResult = await query(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM people"
      );
      resolvedSortOrder = Number(sortResult.rows[0].next_sort_order);
    }

    const result = await query(
      `INSERT INTO people
         (first_name, last_name, coetus, konvent, is_visible, disallow_debt, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        first_name,
        last_name,
        coetus || null,
        konvent || null,
        Boolean(is_visible),
        Boolean(disallow_debt),
        resolvedSortOrder
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updatePerson(req, res, next) {
  try {
    const id = Number(req.params.id);
    const {
      first_name,
      last_name,
      coetus,
      konvent,
      is_visible = true,
      disallow_debt = false,
      sort_order
    } = req.body;

    if (!id || !first_name || !last_name) {
      return res.status(400).json({ error: "id, first_name and last_name are required" });
    }

    const resolvedSortOrder =
      sort_order === undefined || sort_order === null || sort_order === ""
        ? null
        : Number(sort_order);

    const result = await query(
      `UPDATE people
       SET first_name = $1,
           last_name = $2,
           coetus = $3,
           konvent = $4,
           is_visible = $5,
           disallow_debt = $6,
           sort_order = COALESCE($7, sort_order)
       WHERE id = $8
       RETURNING *`,
      [
        first_name,
        last_name,
        coetus || null,
        konvent || null,
        Boolean(is_visible),
        Boolean(disallow_debt),
        Number.isInteger(resolvedSortOrder) ? resolvedSortOrder : null,
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deletePerson(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "valid person id is required" });
    }

    const result = await query("DELETE FROM people WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    res.status(204).send();
  } catch (error) {
    if (error.code === "23503") {
      try {
        const id = Number(req.params.id);
        const result = await query(
          `UPDATE people
           SET is_visible = FALSE
           WHERE id = $1
           RETURNING id`,
          [id]
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Person not found" });
        }

        return res.json({
          id,
          deleted: false,
          hidden: true
        });
      } catch (hideError) {
        return next(hideError);
      }
    }
    next(error);
  }
}
