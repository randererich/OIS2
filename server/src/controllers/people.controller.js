import { hasTableColumn, query } from "../db.js";

const COETUS_SORT_SQL = `
  CASE WHEN coetus ~ '^\\d{4}/(I|II)$' THEN 1 ELSE 0 END DESC,
  CASE WHEN coetus ~ '^\\d{4}/(I|II)$' THEN split_part(coetus, '/', 1)::INT ELSE 0 END DESC,
  CASE split_part(coetus, '/', 2)
    WHEN 'II' THEN 2
    WHEN 'I' THEN 1
    ELSE 0
  END DESC
`;

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

export async function getPeople(req, res, next) {
  try {
    const q = (req.query.q || "").trim();

    if (q) {
      const result = await query(
        `SELECT *
         FROM people
         WHERE CONCAT(first_name, ' ', last_name) ILIKE $1
            OR COALESCE(coetus, '') ILIKE $1
            OR COALESCE(konvent, '') ILIKE $1
         ORDER BY ${COETUS_SORT_SQL}, last_name ASC, first_name ASC`,
        [`%${q}%`]
      );
      return res.json(result.rows);
    }

    const result = await query(
      `SELECT *
       FROM people
       ORDER BY ${COETUS_SORT_SQL}, last_name ASC, first_name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getVisiblePeople(req, res, next) {
  try {
    const q = (req.query.q || "").trim();
    const params = [];
    const where = ["is_visible = TRUE"];

    if (q) {
      params.push(`%${q}%`);
      where.push("CONCAT(first_name, ' ', last_name) ILIKE $1");
    }

    const result = await query(
      `SELECT *
       FROM people
       WHERE ${where.join(" AND ")}
       ORDER BY ${COETUS_SORT_SQL}, sort_order ASC, last_name ASC, first_name ASC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getRecentBuyers(req, res, next) {
  try {
    const requestedMinutes = Number.parseInt(String(req.query.minutes || "20"), 10);
    const minutes = Number.isInteger(requestedMinutes) && requestedMinutes > 0
      ? Math.min(requestedMinutes, 720)
      : 20;

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
       ORDER BY r.last_purchase_at DESC, pe.last_name ASC, pe.first_name ASC`,
      [minutes]
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

export async function getPersonMonthlyPurchases(req, res, next) {
  try {
    const personId = Number(req.params.id);
    const month = req.query.month;
    const includeCancelled = String(req.query.include_cancelled || "false") === "true";

    if (!personId) {
      return res.status(400).json({ error: "valid person id is required" });
    }

    const parsedMonth = parseMonth(month);
    if (!parsedMonth) {
      return res.status(400).json({ error: "month must be YYYY-MM" });
    }

    const personResult = await query(
      `SELECT id, first_name, last_name, debt AS balance
       FROM person_debts
       WHERE id = $1`,
      [personId]
    );

    if (personResult.rowCount === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    const params = [personId, parsedMonth.start.toISOString(), parsedMonth.end.toISOString()];
    let cancellationFilter = "AND pu.is_cancelled = FALSE";
    if (includeCancelled) {
      cancellationFilter = "";
    }

    const summaryResult = await query(
      `SELECT
         pu.product_id,
         pr.name AS product_name,
         SUM(pu.quantity)::NUMERIC(10,2) AS total_quantity,
         SUM(pu.total_price)::NUMERIC(10,2) AS total_sum
       FROM purchases pu
       JOIN products pr ON pr.id = pu.product_id
       WHERE pu.person_id = $1
         AND pu.created_at >= $2
         AND pu.created_at < $3
         ${cancellationFilter}
       GROUP BY pu.product_id, pr.name
       ORDER BY total_quantity DESC, total_sum DESC, pr.name ASC`,
      params
    );

        const hasProductUnit = await hasTableColumn("products", "unit");
        const unitSql = hasProductUnit ? "pr.unit" : "'tk'::TEXT AS unit";

    const purchasesResult = await query(
      `SELECT
         pu.id,
         pu.created_at,
         pr.name AS product_name,
          ${unitSql},
         pu.quantity,
         pu.total_price,
         pu.comment,
         pu.is_cancelled
       FROM purchases pu
       JOIN products pr ON pr.id = pu.product_id
       WHERE pu.person_id = $1
         AND pu.created_at >= $2
         AND pu.created_at < $3
         ${cancellationFilter}
       ORDER BY pu.created_at DESC`,
      params
    );

    res.json({
      person: personResult.rows[0],
      month,
      summary_by_product: summaryResult.rows,
      purchases: purchasesResult.rows
    });
  } catch (error) {
    next(error);
  }
}

export async function createPerson(req, res, next) {
  try {
    const {
      first_name,
      last_name,
      coetus,
      konvent,
      is_visible = true,
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
         (first_name, last_name, coetus, konvent, is_visible, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        first_name,
        last_name,
        coetus || null,
        konvent || null,
        Boolean(is_visible),
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
           sort_order = COALESCE($6, sort_order)
       WHERE id = $7
       RETURNING *`,
      [
        first_name,
        last_name,
        coetus || null,
        konvent || null,
        Boolean(is_visible),
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
    const result = await query("DELETE FROM people WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    res.status(204).send();
  } catch (error) {
    if (error.code === "23503") {
      error.status = 400;
      error.message = "Cannot delete person with existing purchases or payments. Hide person instead.";
    }
    next(error);
  }
}
